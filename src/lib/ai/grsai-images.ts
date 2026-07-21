/**
 * 乘丰 Feng AI — POST /v1/images/generations（大纲 4K 优先通道）
 * 文档：https://api.cphone.vip/docs
 */

import { persistRemoteImage } from "@/lib/ai/grsai";

/** 乘丰 4K 默认节点 */
const DEFAULT_IMAGES_BASE_URL = "https://api.cphone.vip";
const PROMPT_MAX = 1000;
/** 4K 通道固定使用最高画质 */
export const FENG_4K_DEFAULT_QUALITY = "high" as const;

export type GrsaiImagesParams = {
  prompt: string;
  size: string;
  model?: string;
  quality?: "auto" | "low" | "medium" | "high";
  referenceUrls: string[];
};

type ImagesGenResponse = {
  created?: number;
  data?: { url?: string; b64_json?: string }[];
  error?: { message?: string; code?: string };
  code?: number;
  msg?: string;
};

function getConfig() {
  const apiKey =
    process.env.GRSAI_IMAGES_API_KEY || process.env.GRSAI_API_KEY || "";
  const baseUrl = (
    process.env.GRSAI_IMAGES_BASE_URL || DEFAULT_IMAGES_BASE_URL
  ).replace(/\/$/, "");
  return { apiKey, baseUrl };
}

/** 转为外部 API 可访问的 image URL（与 Draw urls 逻辑一致） */
export function formatImagesApiUrls(urls: string[]): string[] {
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

function extractImagesUrl(json: ImagesGenResponse): string | null {
  const item = json.data?.[0];
  if (item?.url?.trim()) return item.url.trim();
  if (item?.b64_json) {
    return `data:image/png;base64,${item.b64_json}`;
  }
  return null;
}

export async function generateWithGrsaiImages(
  params: GrsaiImagesParams
): Promise<string | null> {
  const { apiKey, baseUrl } = getConfig();
  if (!apiKey || !params.referenceUrls.length) return null;

  const timeoutMs = Number(process.env.GRSAI_IMAGES_TIMEOUT_MS) || 540_000;

  const body = {
    model: params.model || "gpt-image-2-vip",
    prompt: params.prompt.slice(0, PROMPT_MAX),
    size: params.size,
    quality: params.quality ?? FENG_4K_DEFAULT_QUALITY,
    response_format: "url",
    image: formatImagesApiUrls(params.referenceUrls),
  };

  console.info(
    `[FengAI 4K] POST ${baseUrl}/v1/images/generations model=${body.model} size=${body.size} quality=${body.quality}`
  );

  const res = await fetch(`${baseUrl}/v1/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await res.text();
  let json: ImagesGenResponse;
  try {
    json = JSON.parse(text) as ImagesGenResponse;
  } catch {
    console.error("[FengAI 4K] invalid JSON", res.status, text.slice(0, 200));
    return null;
  }

  if (!res.ok) {
    console.error(
      "[FengAI 4K] HTTP",
      res.status,
      json.error?.message || json.msg || text.slice(0, 200)
    );
    return null;
  }

  if (json.code !== undefined && json.code !== 0) {
    console.error("[FengAI 4K] API error", json.code, json.msg);
    return null;
  }

  const remoteUrl = extractImagesUrl(json);
  if (!remoteUrl) {
    console.error("[FengAI 4K] no url in response", json);
    return null;
  }

  return persistRemoteImage(remoteUrl);
}
