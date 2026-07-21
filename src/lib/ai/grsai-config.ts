/** 幻灯片生成画质：标准 gpt-image-2 / 高清 gpt-image-2-vip 4K */
export type ImageQuality = "standard" | "hd";

export const IMAGE_QUALITY_LABELS: Record<ImageQuality, string> = {
  standard: "标准",
  hd: "高清 4K",
};

export function parseImageQuality(value: string | null | undefined): ImageQuality {
  return value === "hd" ? "hd" : "standard";
}

/** 标准模型像素（旧 draw/completions 常用值） */
function standardPixelsForRatio(ratio: string): string {
  switch (ratio) {
    case "4:3":
      return "1024x768";
    case "9:16":
      return "1024x1792";
    case "16:9":
    default:
      return "1792x1024";
  }
}

/** VIP 仅 4K，按项目画幅比例映射（Apifox 文档） */
function vip4kPixelsForRatio(ratio: string): string {
  switch (ratio) {
    case "4:3":
      return "3264x2448";
    case "9:16":
      return "2160x3840";
    case "16:9":
    default:
      return "3840x2160";
  }
}

export type GrsaiDrawConfig = {
  model: string;
  aspectRatio: string;
  imageQuality: ImageQuality;
  label: string;
};

export function resolveGrsaiDrawConfig(
  projectAspectRatio: string | undefined,
  imageQuality: ImageQuality
): GrsaiDrawConfig {
  const ratio = projectAspectRatio || "16:9";

  if (imageQuality === "hd") {
    return {
      model: "gpt-image-2-vip",
      aspectRatio: vip4kPixelsForRatio(ratio),
      imageQuality: "hd",
      label: "GPT Image 2 · 4K",
    };
  }

  const defaultModel = process.env.GRSAI_MODEL || "gpt-image-2";
  return {
    model: defaultModel === "gpt-image-2-vip" ? "gpt-image-2" : defaultModel,
    aspectRatio: standardPixelsForRatio(ratio),
    imageQuality: "standard",
    label: "GPT Image 2",
  };
}

/** DALL·E 格式 /v1/images/generations — 4K 优先通道（须 gpt-image-2-vip 才输出真 4K） */
export function resolveGrsaiImagesConfig(
  projectAspectRatio: string | undefined
): { model: string; size: string; label: string } {
  const ratio = projectAspectRatio || "16:9";
  const envModel = process.env.GRSAI_IMAGES_MODEL;
  const model =
    envModel && envModel !== "gpt-image-2"
      ? envModel
      : "gpt-image-2-vip";
  return {
    model,
    size: vip4kPixelsForRatio(ratio),
    label: "乘丰 Feng AI · 4K",
  };
}

/** Draw 回退：供应商现仅稳定支持 1K */
export function resolveGrsaiDrawFallbackConfig(
  projectAspectRatio: string | undefined
): { model: string; aspectRatio: string } {
  const ratio = projectAspectRatio || "16:9";
  const defaultModel = process.env.GRSAI_MODEL || "gpt-image-2";
  return {
    model: defaultModel === "gpt-image-2-vip" ? "gpt-image-2" : defaultModel,
    aspectRatio: standardPixelsForRatio(ratio),
  };
}
