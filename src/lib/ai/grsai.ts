/**
 * GrsAI GPT Image — https://grsai.dakka.com.cn (国内) / https://grsaiapi.com (海外)
 * 文档：POST /v1/api/generate（replyType=async），再 GET /v1/api/result?id=
 */

import { getGrsaiApiKeys } from "@/lib/ai/grsai-keys";
import { getStandardDrawModelChain } from "@/lib/ai/image-model-fallbacks";

const DEFAULT_BASE_URL = "https://grsai.dakka.com.cn";
const GLOBAL_BASE_URL = "https://grsaiapi.com";

/** 只接受 quality=auto，且只接受比例或 1K 像素 */
const STANDARD_MODELS = new Set([
  "gpt-image-2",
  "gpt-image-2.5",
  "gpt-image-2.6",
]);

/** 旧 draw 接口尺寸 → 新版 1K 像素 */
const LEGACY_STANDARD_PIXELS: Record<string, string> = {
  "1792x1024": "1672x941",
  "1024x768": "1443x1090",
  "1024x1792": "941x1672",
};

type TaskPayload = {
  id?: string;
  progress?: number;
  status?: string;
  failure_reason?: string;
  error?: string;
  url?: string;
  results?: { url?: string; imageUrl?: string }[];
  code?: number;
  msg?: string;
  data?: TaskPayload;
};

export type GrsaiDrawParams = {
  prompt: string;
  model?: string;
  aspectRatio?: string;
  quality?: "auto" | "low" | "medium" | "high" | "xhigh" | "max";
  referenceUrls?: string[];
};

export type GrsaiGenerateOptions = {
  keySlotIndex?: number;
  /** 覆盖默认标清模型链（4K 回退传入 vip / flare / sunburst） */
  models?: string[];
};

/** 轮询超时：不再提交新任务，由上层提示用户刷新 */
export class GrsaiPollTimeoutError extends Error {
  constructor(
    readonly taskId: string,
    readonly waitedSec: number
  ) {
    super(`GrsAI poll timeout after ${waitedSec}s (task ${taskId})`);
    this.name = "GrsaiPollTimeoutError";
  }
}

/** 从 GrsAI 结果中提取图片 URL（兼容多种返回格式） */
export function extractGrsaiImageUrl(data: TaskPayload): string | null {
  if (data.url?.trim()) return data.url.trim();
  for (const item of data.results ?? []) {
    const u = item.url?.trim() || item.imageUrl?.trim();
    if (u) return u;
  }
  return null;
}

export function qualityForGrsaiModel(
  model: string,
  requested?: string | null
): string {
  if (STANDARD_MODELS.has(model)) return "auto";
  const q = (requested || "high").toLowerCase();
  if (model === "gpt-image-2.5-sunburst") {
    const allowed = ["auto", "low", "medium", "high", "xhigh", "max"];
    return allowed.includes(q) ? q : "high";
  }
  const allowed = ["auto", "low", "medium", "high"];
  return allowed.includes(q) ? q : "high";
}

export function aspectRatioForGrsaiModel(
  model: string,
  aspectRatio?: string | null
): string {
  const raw = aspectRatio?.trim() || (STANDARD_MODELS.has(model) ? "1672x941" : "1024x1024");
  if (STANDARD_MODELS.has(model)) return LEGACY_STANDARD_PIXELS[raw] || raw;
  return raw;
}

/** 组装 /v1/api/generate 请求体（不含密钥） */
export function buildGrsaiGenerateBody(
  params: GrsaiDrawParams,
  defaultModel: string
): Record<string, unknown> {
  const model = params.model || defaultModel;
  const body: Record<string, unknown> = {
    model,
    prompt: params.prompt,
    aspectRatio: aspectRatioForGrsaiModel(model, params.aspectRatio),
    quality: qualityForGrsaiModel(model, params.quality),
    replyType: "async",
  };

  body.images = formatReferenceImages(params.referenceUrls);
  return body;
}

function formatReferenceImages(urls?: string[]): string[] {
  if (!urls?.length) return [];
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
    /\/$/,
    ""
  );
  return urls.slice(0, 4).map((u) => {
    if (u.startsWith("http://") || u.startsWith("https://")) return u;
    if (u.startsWith("data:image/")) return u;
    if (u.startsWith("/api/files/")) return `${base}${u}`;
    if (u.length > 100 && !u.includes(" ")) {
      return `data:image/jpeg;base64,${u}`;
    }
    return u;
  });
}

function unwrapTask(json: TaskPayload): TaskPayload {
  if (json.data && (json.data.id || json.data.status || json.data.results || json.data.url)) {
    return json.data;
  }
  return json;
}

function isTerminalFailure(status?: string): boolean {
  const s = status?.toLowerCase();
  return s === "failed" || s === "violation";
}

function isSucceeded(data: TaskPayload): boolean {
  const status = data.status?.toLowerCase();
  if (status === "succeeded" || status === "success") return true;
  const url = extractGrsaiImageUrl(data);
  return Boolean(url && (data.progress ?? 0) >= 100);
}

function getDrawRuntimeConfig() {
  const baseUrl = (process.env.GRSAI_BASE_URL || DEFAULT_BASE_URL).replace(
    /\/$/,
    ""
  );
  const model = process.env.GRSAI_MODEL || "gpt-image-2";
  return { baseUrl, model };
}

/** 国内节点失败时再试海外节点（以及可选的 GRSAI_IMAGES_FALLBACK_BASE_URL） */
export function grsaiGenerateBaseUrls(): string[] {
  const primary = getDrawRuntimeConfig().baseUrl;
  const extra = process.env.GRSAI_IMAGES_FALLBACK_BASE_URL?.trim().replace(
    /\/$/,
    ""
  );
  const urls = [primary];
  if (extra && extra !== primary) urls.push(extra);
  const global = GLOBAL_BASE_URL.replace(/\/$/, "");
  if (!urls.includes(global)) urls.push(global);
  return urls;
}

let grsaiKeyRotate = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type SubmitResult =
  | { kind: "task"; taskId: string }
  | { kind: "url"; url: string }
  | { kind: "rejected"; error: Error }
  | { kind: "transport" };

async function submitGenerateTask(
  params: GrsaiDrawParams,
  apiKey: string,
  baseUrl: string,
  defaultModel: string
): Promise<SubmitResult> {
  const body = buildGrsaiGenerateBody(params, defaultModel);
  const model = String(body.model);

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/v1/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    console.error(
      `[GrsAI] submit transport ${baseUrl}`,
      e instanceof Error ? e.message : e
    );
    return { kind: "transport" };
  }

  const text = await res.text();
  let json: TaskPayload;
  try {
    json = JSON.parse(text) as TaskPayload;
  } catch {
    console.error("[GrsAI] submit invalid JSON", res.status, text.slice(0, 200));
    return res.status >= 500 || res.status === 404
      ? { kind: "transport" }
      : { kind: "rejected", error: new Error(`GrsAI: invalid response (${res.status})`) };
  }

  if (typeof json.code === "number" && json.code !== 0) {
    const detail = json.msg || json.error || `code ${json.code}`;
    console.error("[GrsAI] submit error", detail);
    return { kind: "rejected", error: new Error(`GrsAI: ${detail}`) };
  }

  const task = unwrapTask(json);
  if (isTerminalFailure(task.status)) {
    const detail = task.error || task.failure_reason || json.msg || "generate failed";
    console.error("[GrsAI] submit failed", detail);
    return { kind: "rejected", error: new Error(`GrsAI: ${detail}`) };
  }

  if (isSucceeded(task)) {
    const imageUrl = extractGrsaiImageUrl(task);
    if (imageUrl) return { kind: "url", url: imageUrl };
  }

  if (task.id) return { kind: "task", taskId: task.id };

  if (!res.ok) {
    const detail = task.error || json.msg || text.slice(0, 200);
    console.error("[GrsAI] submit HTTP", res.status, detail);
    if (res.status === 404 || res.status >= 500) return { kind: "transport" };
    return { kind: "rejected", error: new Error(`GrsAI: ${detail}`) };
  }

  console.error("[GrsAI] submit missing id", model, json);
  return { kind: "rejected", error: new Error("GrsAI: submit response missing task id") };
}

function getPollSettings(model?: string) {
  const isVip = Boolean(model && !STANDARD_MODELS.has(model));
  const delayMs =
    Number(process.env.GRSAI_POLL_DELAY_MS) || (isVip ? 3000 : 2500);
  const maxAttempts =
    Number(process.env.GRSAI_POLL_ATTEMPTS) || (isVip ? 180 : 120);
  const graceAttempts =
    Number(process.env.GRSAI_POLL_GRACE_ATTEMPTS) || (isVip ? 40 : 20);
  return { maxAttempts, graceAttempts, delayMs, isVip };
}

type PollRoundResult =
  | { type: "success"; url: string }
  | { type: "failed"; error: Error }
  | { type: "pending" };

async function pollDrawRound(
  taskId: string,
  apiKey: string,
  baseUrl: string
): Promise<PollRoundResult> {
  let res: Response;
  try {
    const url = `${baseUrl}/v1/api/result?id=${encodeURIComponent(taskId)}`;
    res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return { type: "pending" };
  }

  let json: TaskPayload;
  try {
    json = (await res.json()) as TaskPayload;
  } catch {
    return { type: "pending" };
  }

  if (typeof json.code === "number" && json.code !== 0 && !json.data && !json.status) {
    console.warn("[GrsAI] poll transient", json.code, json.msg);
    return { type: "pending" };
  }

  const data = unwrapTask(json);
  const status = data.status?.toLowerCase();

  if (isTerminalFailure(status)) {
    const detail = data.error || data.failure_reason || json.msg || "unknown";
    console.error("[GrsAI] task failed", detail);
    return { type: "failed", error: new Error(`GrsAI: ${detail}`) };
  }

  if (!res.ok) {
    if (data.error && res.status === 400) {
      return { type: "failed", error: new Error(`GrsAI: ${data.error}`) };
    }
    return { type: "pending" };
  }

  if (isSucceeded(data)) {
    const imageUrl = extractGrsaiImageUrl(data);
    if (imageUrl) return { type: "success", url: imageUrl };
    if (status === "succeeded" || status === "success") {
      return {
        type: "failed",
        error: new Error("GrsAI: succeeded but no image URL in response"),
      };
    }
  }

  return { type: "pending" };
}

async function pollDrawResult(
  taskId: string,
  apiKey: string,
  baseUrl: string,
  model?: string
): Promise<string> {
  if (!apiKey) {
    throw new Error("GrsAI: missing API key");
  }

  const { maxAttempts, graceAttempts, delayMs } = getPollSettings(model);
  const totalAttempts = maxAttempts + graceAttempts;

  for (let i = 0; i < totalAttempts; i++) {
    const round = await pollDrawRound(taskId, apiKey, baseUrl);

    if (round.type === "success") return round.url;
    if (round.type === "failed") throw round.error;

    await sleep(delayMs);
  }

  const waitedSec = Math.round((totalAttempts * delayMs) / 1000);
  console.error(`[GrsAI] poll timeout after ${waitedSec}s`, taskId, model || "");
  throw new GrsaiPollTimeoutError(taskId, waitedSec);
}

/** 远程 URL 拉取后存本地，返回短路径（避免 DB 存巨型 base64） */
export async function persistRemoteImage(remoteUrl: string): Promise<string> {
  try {
    const { persistSlideImage } = await import("@/lib/storage/slide-image");
    return await persistSlideImage(remoteUrl);
  } catch (e) {
    console.warn("[GrsAI] persist image failed, keeping remote url", e);
    return remoteUrl;
  }
}

async function generateWithGrsaiDrawOneModel(
  params: GrsaiDrawParams,
  options?: GrsaiGenerateOptions
): Promise<string | null> {
  const keys = getGrsaiApiKeys();
  if (!keys.length) return null;

  const { model: defaultModel } = getDrawRuntimeConfig();
  const model = params.model || defaultModel;
  const baseUrls = grsaiGenerateBaseUrls();
  const perKeyRetries = Math.max(
    1,
    Number(process.env.GRSAI_GENERATE_RETRIES) || 1
  );
  const startSlot =
    options?.keySlotIndex !== undefined
      ? options.keySlotIndex % keys.length
      : grsaiKeyRotate++ % keys.length;
  const maxAttempts = keys.length * perKeyRetries;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const keyIndex = (startSlot + attempt) % keys.length;
    const apiKey = keys[keyIndex];
    const logTag = `GrsAI ${model} key ${keyIndex + 1}/${keys.length}`;
    let rejected: Error | null = null;

    for (const baseUrl of baseUrls) {
      try {
        const submitted = await submitGenerateTask(
          params,
          apiKey,
          baseUrl,
          model
        );
        if (submitted.kind === "transport") {
          console.warn(`[${logTag}] ${baseUrl} unreachable, next host`);
          continue;
        }
        if (submitted.kind === "rejected") {
          rejected = submitted.error;
          break;
        }

        const remoteUrl =
          submitted.kind === "url"
            ? submitted.url
            : await pollDrawResult(submitted.taskId, apiKey, baseUrl, model);
        return persistRemoteImage(remoteUrl);
      } catch (e) {
        if (e instanceof GrsaiPollTimeoutError) throw e;
        rejected = e instanceof Error ? e : new Error(String(e));
        break;
      }
    }

    const isLast = attempt === maxAttempts - 1;
    if (!rejected) {
      if (!isLast) {
        const waitMs = 3000 * ((attempt % perKeyRetries) + 1);
        console.warn(`[${logTag}] submit failed, switch/wait ${waitMs}ms`);
        await sleep(waitMs);
      }
      continue;
    }

    const isTaskFailed = rejected.message.startsWith("GrsAI:");
    if (isTaskFailed && !isLast) {
      const waitMs = 5000 * ((attempt % perKeyRetries) + 1);
      console.warn(`[${logTag}] task failed, switch/wait ${waitMs}ms:`, rejected.message);
      await sleep(waitMs);
      continue;
    }

    console.error(`[${logTag}] generate error`, rejected);
    if (isTaskFailed) throw rejected;
    if (!isLast) {
      await sleep(3000);
      continue;
    }
    return null;
  }

  return null;
}

export async function generateWithGrsai(
  params: GrsaiDrawParams,
  options?: GrsaiGenerateOptions
): Promise<string | null> {
  const { model: defaultModel } = getDrawRuntimeConfig();
  const models = options?.models?.length
    ? [...new Set(options.models.map((m) => m.trim()).filter(Boolean))]
    : getStandardDrawModelChain(params.model || defaultModel);

  for (let mi = 0; mi < models.length; mi++) {
    const model = models[mi];
    try {
      const url = await generateWithGrsaiDrawOneModel(
        { ...params, model },
        options
      );
      if (url) return url;
    } catch (e) {
      if (e instanceof GrsaiPollTimeoutError) throw e;
      console.warn(
        `[GrsAI] model ${model} failed:`,
        e instanceof Error ? e.message : e
      );
    }
    if (mi < models.length - 1) {
      console.warn(`[GrsAI] model ${model} exhausted, next: ${models[mi + 1]}`);
    }
  }

  return null;
}

export function isGrsaiConfigured(): boolean {
  return getGrsaiApiKeys().length > 0;
}
