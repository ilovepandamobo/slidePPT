/**
 * GrsAI GPT Image 2 — https://grsai.dakka.com.cn (国内) / https://grsaiapi.com (海外)
 * 文档：POST /v1/draw/completions，webHook=-1 立即返回 id，再轮询 /v1/draw/result
 */

const DEFAULT_BASE_URL = "https://grsai.dakka.com.cn";

type DrawSubmitResponse = {
  code: number;
  msg: string;
  data?: { id: string };
};

type DrawResultPayload = {
  id: string;
  progress: number;
  status: string;
  failure_reason?: string;
  error?: string;
  url?: string;
  results?: { url?: string; imageUrl?: string }[];
};

type DrawResultResponse = {
  code: number;
  msg: string;
  data?: DrawResultPayload;
};

export type GrsaiDrawParams = {
  prompt: string;
  model?: string;
  aspectRatio?: string;
  quality?: "auto" | "low" | "medium" | "high";
  referenceUrls?: string[];
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

/** 从 GrsAI 轮询结果中提取图片 URL（兼容多种返回格式） */
export function extractGrsaiImageUrl(data: DrawResultPayload): string | null {
  if (data.url?.trim()) return data.url.trim();
  for (const item of data.results ?? []) {
    const u = item.url?.trim() || item.imageUrl?.trim();
    if (u) return u;
  }
  return null;
}

function isDrawSucceeded(data: DrawResultPayload): boolean {
  const status = data.status?.toLowerCase();
  if (status === "succeeded" || status === "success") return true;
  const url = extractGrsaiImageUrl(data);
  return Boolean(url && data.progress >= 100);
}

function getConfig() {
  const apiKey = process.env.GRSAI_API_KEY;
  const baseUrl = (process.env.GRSAI_BASE_URL || DEFAULT_BASE_URL).replace(
    /\/$/,
    ""
  );
  const model = process.env.GRSAI_MODEL || "gpt-image-2";
  return { apiKey, baseUrl, model };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function submitDrawTask(params: GrsaiDrawParams): Promise<string | null> {
  const { apiKey, baseUrl, model: defaultModel } = getConfig();
  if (!apiKey) return null;

  const body: Record<string, unknown> = {
    model: params.model || defaultModel,
    prompt: params.prompt,
    aspectRatio: params.aspectRatio || "1792x1024",
    quality: params.quality || "high",
    webHook: "-1",
    shutProgress: true,
  };

  if (params.referenceUrls?.length) {
    body.urls = params.referenceUrls.slice(0, 4).map((u) => {
      if (u.startsWith("http://") || u.startsWith("https://")) return u;
      if (u.startsWith("data:image/")) return u;
      if (u.length > 100 && !u.includes(" ")) {
        return `data:image/jpeg;base64,${u}`;
      }
      return u;
    });
  }

  const res = await fetch(`${baseUrl}/v1/draw/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error("[GrsAI] submit HTTP", res.status, await res.text());
    return null;
  }

  const json = (await res.json()) as DrawSubmitResponse;
  if (json.code !== 0 || !json.data?.id) {
    console.error("[GrsAI] submit error", json.msg, json);
    return null;
  }

  return json.data.id;
}

function getPollSettings(model?: string) {
  const isVip = model?.includes("vip");
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
  const res = await fetch(`${baseUrl}/v1/draw/result`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ id: taskId }),
  });

  if (!res.ok) {
    return { type: "pending" };
  }

  let json: DrawResultResponse;
  try {
    json = (await res.json()) as DrawResultResponse;
  } catch {
    return { type: "pending" };
  }

  if (json.code === -22 || json.code !== 0 || !json.data) {
    if (json.code !== 0 && json.code !== -22) {
      console.warn("[GrsAI] poll transient", json.code, json.msg);
    }
    return { type: "pending" };
  }

  const data = json.data;
  const status = data.status?.toLowerCase();

  if (status === "failed" || status === "violation") {
    const detail = data.error || data.failure_reason || "unknown";
    console.error("[GrsAI] task failed", data.failure_reason, data.error);
    return { type: "failed", error: new Error(`GrsAI: ${detail}`) };
  }

  if (isDrawSucceeded(data)) {
    const imageUrl = extractGrsaiImageUrl(data);
    if (imageUrl) {
      return { type: "success", url: imageUrl };
    }
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
  model?: string
): Promise<string> {
  const { apiKey, baseUrl } = getConfig();
  if (!apiKey) {
    throw new Error("GrsAI: missing API key");
  }

  const { maxAttempts, graceAttempts, delayMs } = getPollSettings(model);
  const totalAttempts = maxAttempts + graceAttempts;

  for (let i = 0; i < totalAttempts; i++) {
    const round = await pollDrawRound(taskId, apiKey, baseUrl);

    if (round.type === "success") {
      return round.url;
    }
    if (round.type === "failed") {
      throw round.error;
    }

    await sleep(delayMs);
  }

  const waitedSec = Math.round((totalAttempts * delayMs) / 1000);
  console.error(
    `[GrsAI] poll timeout after ${waitedSec}s`,
    taskId,
    model || ""
  );
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

export async function generateWithGrsai(
  params: GrsaiDrawParams
): Promise<string | null> {
  if (!process.env.GRSAI_API_KEY) return null;

  const maxTries = Math.max(
    1,
    Number(process.env.GRSAI_GENERATE_RETRIES) || 1
  );

  for (let attempt = 1; attempt <= maxTries; attempt++) {
    try {
      const taskId = await submitDrawTask(params);
      if (!taskId) {
        if (attempt < maxTries) {
          console.warn(
            `[GrsAI] submit failed, retry ${attempt + 1}/${maxTries}`
          );
          await sleep(3000);
          continue;
        }
        return null;
      }

      const remoteUrl = await pollDrawResult(taskId, params.model);
      return persistRemoteImage(remoteUrl);
    } catch (e) {
      if (e instanceof GrsaiPollTimeoutError) {
        throw e;
      }

      const isTaskFailed =
        e instanceof Error && e.message.startsWith("GrsAI:");

      if (isTaskFailed && attempt < maxTries) {
        console.warn(
          `[GrsAI] task failed, retry ${attempt + 1}/${maxTries}:`,
          e instanceof Error ? e.message : e
        );
        await sleep(5000);
        continue;
      }

      console.error("[GrsAI] generate error", e);
      if (isTaskFailed) throw e;
      return null;
    }
  }

  return null;
}

export function isGrsaiConfigured(): boolean {
  return Boolean(process.env.GRSAI_API_KEY);
}
