/**
 * 高清 4K 链路（典型：乘丰 key×2 + GrsAI key×1）：
 * 1. 乘丰 GRSAI_IMAGES_API_KEY / _2 分流 POST …/images/generations
 * 2. 失败 → GrsAI GRSAI_API_KEY 同格式 4K（GRSAI_BASE_URL）
 * 不降 1K；Draw vip 4K 像素不可用故跳过
 */

import {
  generateWithGrsaiImages,
  generateWithGrsaiPlatformImages,
  FENG_4K_DEFAULT_QUALITY,
} from "@/lib/ai/grsai-images";
import { resolveGrsaiImagesConfig } from "@/lib/ai/grsai-config";

export type OutlineHdResult = {
  url: string | null;
  provider: string;
  usedDrawFallback: boolean;
};

/** 项目设为 hd 时一律走乘丰 4K（含编辑器重设计、上传参考修改） */
export function isOutlineHdGeneration(options: {
  imageQuality?: string | null;
  isLayoutRemix?: boolean;
  isRedesign?: boolean;
  isUploadReference?: boolean;
}): boolean {
  return options.imageQuality === "hd";
}

async function runHdImagesChannels(
  prompt: string,
  refs: string[],
  imagesCfg: ReturnType<typeof resolveGrsaiImagesConfig>,
  fengKeySlotIndex: number | undefined,
  label: string
): Promise<OutlineHdResult | null> {
  console.info(`[outline-hd] ${label} refs=${refs.length}`);

  const imageParams = {
    prompt,
    size: imagesCfg.size,
    model: imagesCfg.model,
    quality: FENG_4K_DEFAULT_QUALITY,
    referenceUrls: refs,
  };

  try {
    const fengUrl = await generateWithGrsaiImages(imageParams, {
      keySlotIndex: fengKeySlotIndex,
    });
    if (fengUrl) {
      return { url: fengUrl, provider: "feng-ai-4k", usedDrawFallback: false };
    }
    console.warn(`[outline-hd] ${label} Feng empty → GrsAI 4K`);
  } catch (e) {
    console.warn(
      `[outline-hd] ${label} Feng failed → GrsAI 4K:`,
      e instanceof Error ? e.message : e
    );
  }

  try {
    const grsai4k = await generateWithGrsaiPlatformImages(imageParams, {
      keySlotIndex: fengKeySlotIndex,
    });
    if (grsai4k) {
      return {
        url: grsai4k,
        provider: "grsai-images-4k",
        usedDrawFallback: false,
      };
    }
    console.warn(`[outline-hd] ${label} GrsAI 4K empty`);
  } catch (e) {
    console.warn(
      `[outline-hd] ${label} GrsAI 4K failed:`,
      e instanceof Error ? e.message : e
    );
  }

  return null;
}

export async function generateOutlineHdSlide(params: {
  prompt: string;
  referenceUrls?: string[];
  aspectRatio?: string;
  fengKeySlotIndex?: number;
}): Promise<OutlineHdResult> {
  const imagesCfg = resolveGrsaiImagesConfig(params.aspectRatio);
  const refs = params.referenceUrls?.length ? params.referenceUrls : undefined;

  if (!refs?.length) {
    console.warn(
      "[outline-hd] no reference for Feng 4K, trying GrsAI images/generations 4K"
    );
    return { url: null, provider: "none", usedDrawFallback: false };
  }

  const dual = await runHdImagesChannels(
    params.prompt,
    refs,
    imagesCfg,
    params.fengKeySlotIndex,
    "dual-image"
  );
  if (dual?.url) return dual;

  if (refs.length > 1) {
    console.warn(
      "[outline-hd] dual-image 4K failed (often Feng 500), retry current slide only"
    );
    const single = await runHdImagesChannels(
      params.prompt,
      [refs[0]],
      imagesCfg,
      params.fengKeySlotIndex,
      "single-image-fallback"
    );
    if (single?.url) {
      return {
        ...single,
        provider: `${single.provider}-single-ref`,
      };
    }
  }

  console.warn(
    "[outline-hd] all images/generations 4K channels failed (Draw 不支持 vip 4K，已跳过)"
  );
  return { url: null, provider: "none", usedDrawFallback: false };
}
