/**
 * GrsAI DALL·E 格式 — POST /v1/images/generations（4K 优先通道）
 * 文档：prompt + image[] 必填，size 支持 3840x2160 等
 */

import { persistRemoteImage } from "@/lib/ai/grsai";

const DEFAULT_BASE_URL = "https://grsai.dakka.com.cn";
const PROMPT_MAX = 1000;

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
  const apiKey = process.env.GRSAI_API_KEY;
  const baseUrl = (
    process.env.GRSAI_IMAGES_BASE_URL ||
    process.env.GRSAI_BASE_URL ||
    DEFAULT_BASE_URL
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
    model: params.model || "gpt-image-2",
    prompt: params.prompt.slice(0, PROMPT_MAX),
    size: params.size,
    quality: params.quality || "high",
    response_format: "url",
    image: formatImagesApiUrls(params.referenceUrls),
  };

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
    console.error("[GrsAI images] invalid JSON", res.status, text.slice(0, 200));
    return null;
  }

  if (!res.ok) {
    console.error(
      "[GrsAI images] HTTP",
      res.status,
      json.error?.message || json.msg || text.slice(0, 200)
    );
    return null;
  }

  if (json.code !== undefined && json.code !== 0) {
    console.error("[GrsAI images] API error", json.code, json.msg);
    return null;
  }

  const remoteUrl = extractImagesUrl(json);
  if (!remoteUrl) {
    console.error("[GrsAI images] no url in response", json);
    return null;
  }

  return persistRemoteImage(remoteUrl);
}
