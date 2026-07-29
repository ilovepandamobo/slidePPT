/**
 * 高清 4K（首次生成 / 编辑器修改 / 焕新）：优先乘丰 /v1/images/generations，失败回退 Draw 1K
 */

import { generateWithGrsai } from "@/lib/ai/grsai";
import { generateWithGrsaiImages, FENG_4K_DEFAULT_QUALITY } from "@/lib/ai/grsai-images";
import {
  resolveGrsaiDrawFallbackConfig,
  resolveGrsaiImagesConfig,
} from "@/lib/ai/grsai-config";

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

export async function generateOutlineHdSlide(params: {
  prompt: string;
  referenceUrls?: string[];
  aspectRatio?: string;
}): Promise<OutlineHdResult> {
  const imagesCfg = resolveGrsaiImagesConfig(params.aspectRatio);
  const drawFallback = resolveGrsaiDrawFallbackConfig(params.aspectRatio);
  const refs = params.referenceUrls?.length ? params.referenceUrls : undefined;

  if (refs?.length) {
    try {
      const url = await generateWithGrsaiImages({
        prompt: params.prompt,
        size: imagesCfg.size,
        model: imagesCfg.model,
        quality: FENG_4K_DEFAULT_QUALITY,
        referenceUrls: refs,
      });
      if (url) {
        return { url, provider: "feng-ai-4k", usedDrawFallback: false };
      }
      console.warn("[outline-hd] images/generations returned empty, fallback to draw 1K");
    } catch (e) {
      console.warn(
        "[outline-hd] images/generations failed, fallback to draw 1K:",
        e instanceof Error ? e.message : e
      );
    }
  } else {
    console.warn(
      "[outline-hd] no reference image for DALL-E 4K, using draw 1K fallback"
    );
  }

  const url = await generateWithGrsai({
    prompt: params.prompt,
    model: drawFallback.model,
    aspectRatio: drawFallback.aspectRatio,
    quality: "high",
    referenceUrls: refs,
  });
  return {
    url,
    provider: url ? "grsai-draw-1k-fallback" : "none",
    usedDrawFallback: true,
  };
}
