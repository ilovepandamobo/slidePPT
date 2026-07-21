/**
 * 大纲创作 · 高清 4K：优先 DALL·E /v1/images/generations，失败回退 Draw 1K
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

export function isOutlineHdGeneration(options: {
  imageQuality?: string | null;
  isLayoutRemix?: boolean;
  isRedesign?: boolean;
  isUploadReference?: boolean;
}): boolean {
  return (
    options.imageQuality === "hd" &&
    !options.isLayoutRemix &&
    !options.isRedesign &&
    !options.isUploadReference
  );
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
