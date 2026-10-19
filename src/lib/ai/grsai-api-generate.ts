/**
 * GrsAI GPT Image — POST /v1/api/generate（4K vip 回退通道）
 * 文档：/v1/api/generate + GET /v1/api/result?id=
 */

import { formatImagesApiUrls } from "@/lib/ai/grsai-images";
import { persistRemoteImage } from "@/lib/ai/grsai";

const DEFAULT_BASE_URL = "https://grsai.dakka.com.cn";

type ApiGenerateResponse = {
  id?: string;
  status?: string;
  progress?: number;
  results?: { url?: string }[];
  error?: string;
};

export type GrsaiApiGenerateParams = {
  prompt: string;
  model?: string;
  /** VIP 像素，如 3840x2160 */
  aspectRatio: string;
  quality?: "auto" | "low" | "medium" | "high" | "xhigh" | "max";
  referenceUrls?: string[];
};

function getConfig() {
  const apiKey = process.env.GRSAI_API_KEY;
  const baseUrl = (process.env.GRSAI_BASE_URL || DEFAULT_BASE_URL).replace(
    /\/$/,
    ""
  );
  return { apiKey, baseUrl };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractUrl(json: ApiGenerateResponse): string | null {
  const u = json.results?.[0]?.url?.trim();
  return u || null;
}

function getPollSettings(model?: string) {
  const isVip = model?.includes("vip");
  const delayMs =
    Number(process.env.GRSAI_POLL_DELAY_MS) || (isVip ? 3000 : 2500);
  const maxAttempts =
    Number(process.env.GRSAI_POLL_ATTEMPTS) || (isVip ? 180 : 120);
  const graceAttempts =
    Number(process.env.GRSAI_POLL_GRACE_ATTEMPTS) || (isVip ? 40 : 20);
  return { maxAttempts, graceAttempts, delayMs };
}

function parseTerminalStatus(
  json: ApiGenerateResponse
): { ok: true; url: string } | { ok: false; error: string } | null {
  const status = json.status?.toLowerCase();
  if (status === "succeeded" || status === "success") {
    const url = extractUrl(json);
    if (url) return { ok: true, url };
    return { ok: false, error: "succeeded but no image URL" };
  }
  if (status === "failed" || status === "violation") {
    return { ok: false, error: json.error || status || "generate failed" };
  }
  return null;
}

async function pollApiGenerateResult(
  taskId: string,
  model?: string
): Promise<string | null> {
  const { apiKey, baseUrl } = getConfig();
  if (!apiKey) return null;

  const { maxAttempts, graceAttempts, delayMs } = getPollSettings(model);
  const totalAttempts = maxAttempts + graceAttempts;

  for (let i = 0; i < totalAttempts; i++) {
    const res = await fetch(
      `${baseUrl}/v1/api/result?id=${encodeURIComponent(taskId)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );

    if (res.ok) {
      let json: ApiGenerateResponse;
      try {
        json = (await res.json()) as ApiGenerateResponse;
      } catch {
        await sleep(delayMs);
        continue;
      }
      const terminal = parseTerminalStatus(json);
      if (terminal?.ok) return terminal.url;
      if (terminal && !terminal.ok) {
        console.error("[GrsAI api/generate] task failed", terminal.error);
        return null;
      }
    }

    await sleep(delayMs);
  }

  console.error("[GrsAI api/generate] poll timeout", taskId);
  return null;
}

export async function generateWithGrsaiApiGenerate(
  params: GrsaiApiGenerateParams
): Promise<string | null> {
  const { apiKey, baseUrl } = getConfig();
  if (!apiKey) return null;

  const model = params.model || "gpt-image-2-vip";
  const replyType =
    process.env.GRSAI_API_GENERATE_REPLY_TYPE?.trim() || "async";
  const images = params.referenceUrls?.length
    ? formatImagesApiUrls(params.referenceUrls)
    : [];

  const body = {
    model,
    prompt: params.prompt,
    images,
    aspectRatio: params.aspectRatio,
    quality: params.quality ?? "medium",
    replyType,
  };

  const timeoutMs =
    Number(process.env.GRSAI_API_GENERATE_TIMEOUT_MS) || 540_000;

  console.info(
    `[GrsAI 4K] POST ${baseUrl}/v1/api/generate model=${model} aspectRatio=${body.aspectRatio} replyType=${replyType}`
  );

  let json: ApiGenerateResponse;
  try {
    const res = await fetch(`${baseUrl}/v1/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const text = await res.text();
    try {
      json = JSON.parse(text) as ApiGenerateResponse;
    } catch {
      console.error(
        "[GrsAI api/generate] invalid JSON",
        res.status,
        text.slice(0, 200)
      );
      return null;
    }

    if (!res.ok) {
      console.error(
        "[GrsAI api/generate] HTTP",
        res.status,
        json.error || text.slice(0, 200)
      );
      return null;
    }
  } catch (e) {
    console.error(
      "[GrsAI api/generate] request failed:",
      e instanceof Error ? e.message : e
    );
    return null;
  }

  const immediate = parseTerminalStatus(json);
  if (immediate?.ok) {
    return persistRemoteImage(immediate.url);
  }
  if (immediate && !immediate.ok) {
    console.error("[GrsAI api/generate] failed", immediate.error);
    return null;
  }

  const taskId = json.id;
  if (!taskId) {
    console.error("[GrsAI api/generate] no task id in response", json);
    return null;
  }

  const remoteUrl = await pollApiGenerateResult(taskId, model);
  if (!remoteUrl) return null;
  return persistRemoteImage(remoteUrl);
}
