/**
 * OpenAI 格式 POST /v1/images/generations
 * - 乘丰 Feng：GRSAI_IMAGES_*（大纲 4K 优先）
 * - GrsAI 节点：GRSAI_BASE_URL + GRSAI_API_KEY（4K 回退）
 */

import { fetchFengImages, formatFetchError } from "@/lib/ai/feng-long-fetch";
import { persistRemoteImage } from "@/lib/ai/grsai";
import { getGrsaiApiKeys } from "@/lib/ai/grsai-keys";

/** 乘丰 4K 默认节点 */
const DEFAULT_IMAGES_BASE_URL = "https://api.cphone.vip";
const DEFAULT_GRSAI_BASE_URL = "https://grsai.dakka.com.cn";
const DEFAULT_GRSAI_GLOBAL_BASE_URL = "https://grsaiapi.com";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
/** 与 buildSlideGenerationPrompt 上限一致；过短会截掉大纲正文，只剩「参考风格图」指令 */
export const FENG_IMAGES_PROMPT_MAX = 4000;
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

let fengKeyRotate = 0;

/** 乘丰多账号：GRSAI_IMAGES_API_KEY + GRSAI_IMAGES_API_KEY_2，或 GRSAI_IMAGES_API_KEYS 逗号分隔 */
export function getFengImagesApiKeys(): string[] {
  const listEnv = process.env.GRSAI_IMAGES_API_KEYS?.trim();
  if (listEnv) {
    const fromList = listEnv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (fromList.length) return [...new Set(fromList)];
  }

  const keys: string[] = [];
  const k1 = process.env.GRSAI_IMAGES_API_KEY?.trim();
  const k2 = process.env.GRSAI_IMAGES_API_KEY_2?.trim();
  if (k1) keys.push(k1);
  if (k2 && k2 !== k1) keys.push(k2);
  if (keys.length) return keys;

  const fallback = process.env.GRSAI_API_KEY?.trim();
  return fallback ? [fallback] : [];
}

export function getFengImagesApiKeyCount(): number {
  return getFengImagesApiKeys().length;
}

function getFengBaseUrl(): string {
  return (
    process.env.GRSAI_IMAGES_BASE_URL || DEFAULT_IMAGES_BASE_URL
  ).replace(/\/$/, "");
}

function pickFengApiKey(preferredIndex?: number): { apiKey: string; slot: number } {
  const keys = getFengImagesApiKeys();
  if (!keys.length) return { apiKey: "", slot: 0 };
  const slot =
    preferredIndex !== undefined
      ? preferredIndex % keys.length
      : fengKeyRotate++ % keys.length;
  return { apiKey: keys[slot], slot: slot + 1 };
}

/** GrsAI 4K 回退：国内节点失败后试全球节点 */
function getGrsaiPlatformBaseUrls(): string[] {
  const primary = (
    process.env.GRSAI_BASE_URL || DEFAULT_GRSAI_BASE_URL
  ).replace(/\/$/, "");
  const extra = process.env.GRSAI_IMAGES_FALLBACK_BASE_URL?.trim().replace(
    /\/$/,
    ""
  );
  const globalDefault = DEFAULT_GRSAI_GLOBAL_BASE_URL.replace(/\/$/, "");
  const urls = [primary];
  if (extra && extra !== primary) urls.push(extra);
  if (globalDefault !== primary && globalDefault !== extra) {
    urls.push(globalDefault);
  }
  return [...new Set(urls)];
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

async function postImagesGenerations(
  config: { apiKey: string; baseUrl: string; logTag: string },
  params: GrsaiImagesParams
): Promise<string | null> {
  const { apiKey, baseUrl, logTag } = config;
  if (!apiKey || !params.referenceUrls.length) return null;

  const timeoutMs = Number(process.env.GRSAI_IMAGES_TIMEOUT_MS) || 540_000;

  const body = {
    model: params.model || "gpt-image-2-vip",
    prompt: params.prompt.slice(0, FENG_IMAGES_PROMPT_MAX),
    size: params.size,
    quality: params.quality ?? FENG_4K_DEFAULT_QUALITY,
    response_format: "url",
    image: formatImagesApiUrls(params.referenceUrls),
  };

  console.info(
    `[${logTag}] POST ${baseUrl}/v1/images/generations model=${body.model} size=${body.size} quality=${body.quality}`
  );

  let res: Response;
  try {
    res = await fetchFengImages(
      `${baseUrl}/v1/images/generations`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      },
      timeoutMs
    );
  } catch (e) {
    console.error(`[${logTag}] request failed:`, formatFetchError(e));
    return null;
  }

  const text = await res.text();
  let json: ImagesGenResponse;
  try {
    json = JSON.parse(text) as ImagesGenResponse;
  } catch {
    console.error(`[${logTag}] invalid JSON`, res.status, text.slice(0, 200));
    return null;
  }

  if (!res.ok) {
    console.error(
      `[${logTag}] HTTP`,
      res.status,
      json.error?.message || json.msg || text.slice(0, 200)
    );
    return null;
  }

  if (json.code !== undefined && json.code !== 0) {
    console.error(`[${logTag}] API error`, json.code, json.msg);
    return null;
  }

  const remoteUrl = extractImagesUrl(json);
  if (!remoteUrl) {
    console.error(`[${logTag}] no url in response`, json);
    return null;
  }

  return persistRemoteImage(remoteUrl);
}

/** 乘丰 Feng AI 4K：多密钥轮询，失败换下一个 key 再试 */
export async function generateWithGrsaiImages(
  params: GrsaiImagesParams,
  options?: { keySlotIndex?: number }
): Promise<string | null> {
  const keys = getFengImagesApiKeys();
  if (!keys.length) return null;

  const baseUrl = getFengBaseUrl();
  const perKeyRetries = Math.max(
    1,
    Number(process.env.FENG_IMAGES_RETRIES) || 1
  );
  const startSlot =
    options?.keySlotIndex !== undefined
      ? options.keySlotIndex % keys.length
      : fengKeyRotate++ % keys.length;
  const maxAttempts = keys.length * perKeyRetries;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const keyIndex = (startSlot + attempt) % keys.length;
    const apiKey = keys[keyIndex];
    const logTag = `FengAI 4K key ${keyIndex + 1}/${keys.length}`;

    const url = await postImagesGenerations(
      { apiKey, baseUrl, logTag },
      params
    );
    if (url) return url;

    const isLast = attempt === maxAttempts - 1;
    if (!isLast) {
      const waitMs = 6000 * ((attempt % perKeyRetries) + 1);
      console.warn(`[${logTag}] failed, switch/wait ${waitMs}ms`);
      await sleep(waitMs);
    }
  }
  return null;
}

/** GrsAI OpenAI 格式 4K：多密钥 + 国内 → 可选备用 → 全球节点 */
export async function generateWithGrsaiPlatformImages(
  params: GrsaiImagesParams,
  options?: { keySlotIndex?: number }
): Promise<string | null> {
  const keys = getGrsaiApiKeys();
  if (!keys.length) return null;

  const startSlot =
    options?.keySlotIndex !== undefined
      ? options.keySlotIndex % keys.length
      : 0;

  for (const baseUrl of getGrsaiPlatformBaseUrls()) {
    for (let ki = 0; ki < keys.length; ki++) {
      const keyIndex = (startSlot + ki) % keys.length;
      const apiKey = keys[keyIndex];
      const logTag = `GrsAI 4K key ${keyIndex + 1}/${keys.length}`;

      const url = await postImagesGenerations(
        { apiKey, baseUrl, logTag },
        params
      );
      if (url) return url;
    }
    console.warn(`[GrsAI 4K] node failed, trying next base: ${baseUrl}`);
  }
  return null;
}
