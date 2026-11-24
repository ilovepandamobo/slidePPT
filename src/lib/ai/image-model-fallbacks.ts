/** 上游维护/限流时按顺序换模型（可通过环境变量覆盖） */

/** 4K 默认：sunburst → vip（4K 可用）→ flare 系列 */
const DEFAULT_HD_IMAGES_MODELS = [
  "gpt-image-2.6-sunburst",
  "gpt-image-2-vip",
  "gpt-image-2.6-flare",
  "gpt-image-2.6-sunburst-4k",
  "gpt-image-2.6-flare-4k",
  "gpt-image-2.5-sunburst",
  "gpt-image-2.5-flare",
] as const;

const DEFAULT_STANDARD_DRAW_MODELS = [
  "gpt-image-2",
  "gpt-image-2.5",
  "gpt-image-2.6",
] as const;

function parseEnvModelList(env: string | undefined): string[] {
  if (!env?.trim()) return [];
  return env
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function uniqueChain(primary: string, rest: readonly string[]): string[] {
  const chain = [primary, ...rest.filter((m) => m !== primary)];
  return [...new Set(chain)];
}

/** 4K：乘丰 /v1/images/generations，GrsAI 回退走 /v1/api/generate */
export function getHdImagesModelChain(primary?: string | null): string[] {
  const p =
    primary?.trim() ||
    process.env.GRSAI_IMAGES_MODEL?.trim() ||
    "gpt-image-2.6-sunburst";
  const fromEnv = parseEnvModelList(process.env.GRSAI_IMAGES_MODEL_FALLBACKS);
  if (fromEnv.length) {
    return uniqueChain(p, fromEnv);
  }
  return uniqueChain(p, DEFAULT_HD_IMAGES_MODELS);
}

/** GrsAI /v1/api/generate 标清通道（仅 auto 画质、1K 像素） */
export function getStandardDrawModelChain(primary?: string | null): string[] {
  const envPrimary = process.env.GRSAI_MODEL?.trim();
  const p = primary?.trim() || envPrimary || "gpt-image-2";
  const fromEnv = parseEnvModelList(process.env.GRSAI_DRAW_MODEL_FALLBACKS);
  if (fromEnv.length) {
    return uniqueChain(p, fromEnv);
  }
  return uniqueChain(p, DEFAULT_STANDARD_DRAW_MODELS);
}