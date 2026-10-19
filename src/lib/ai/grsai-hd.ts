/**
 * 高清 4K：乘丰 images/generations → GrsAI images/generations 4K → Draw 4K → Draw 1K
 */

import { generateWithGrsai } from "@/lib/ai/grsai";
import {
  generateWithGrsaiImages,
  generateWithGrsaiPlatformImages,
  FENG_4K_DEFAULT_QUALITY,
} from "@/lib/ai/grsai-images";
import {
  resolveGrsaiDrawConfig,
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
      console.warn(
        "[outline-hd] Feng images/generations empty, fallback to GrsAI images/generations 4K"
      );
    } catch (e) {
      console.warn(
        "[outline-hd] Feng images/generations failed, fallback to GrsAI 4K:",
        e instanceof Error ? e.message : e
      );
    }
  } else {
    console.warn(
      "[outline-hd] no reference for Feng 4K, trying GrsAI images/generations 4K"
    );
  }

  if (refs?.length) {
    try {
      const grsai4k = await generateWithGrsaiPlatformImages({
        prompt: params.prompt,
        size: imagesCfg.size,
        model: imagesCfg.model,
        quality: FENG_4K_DEFAULT_QUALITY,
        referenceUrls: refs,
      });
      if (grsai4k) {
        return { url: grsai4k, provider: "grsai-images-4k", usedDrawFallback: false };
      }
      console.warn(
        "[outline-hd] GrsAI images/generations 4K empty, fallback to draw"
      );
    } catch (e) {
      console.warn(
        "[outline-hd] GrsAI images/generations 4K failed, fallback to draw:",
        e instanceof Error ? e.message : e
      );
    }
  }

  const draw4k = resolveGrsaiDrawConfig(params.aspectRatio, "hd");
  try {
    const drawUrl = await generateWithGrsai({
      prompt: params.prompt,
      model: draw4k.model,
      aspectRatio: draw4k.aspectRatio,
      quality: "high",
      referenceUrls: refs,
    });
    if (drawUrl) {
      return {
        url: drawUrl,
        provider: "grsai-draw-4k-fallback",
        usedDrawFallback: true,
      };
    }
  } catch (e) {
    console.warn(
      "[outline-hd] draw 4K failed, fallback to draw 1K:",
      e instanceof Error ? e.message : e
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
