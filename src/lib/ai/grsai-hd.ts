/**
 * 高清 4K：乘丰 images/generations → GrsAI images/generations（Draw 不支持 vip 4K 像素）
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

export async function generateOutlineHdSlide(params: {
  prompt: string;
  referenceUrls?: string[];
  aspectRatio?: string;
  /** 批量生成时按页序号分配乘丰密钥槽位 */
  fengKeySlotIndex?: number;
}): Promise<OutlineHdResult> {
  const imagesCfg = resolveGrsaiImagesConfig(params.aspectRatio);
  const refs = params.referenceUrls?.length ? params.referenceUrls : undefined;

  if (refs?.length) {
    try {
      const url = await generateWithGrsaiImages(
        {
          prompt: params.prompt,
          size: imagesCfg.size,
          model: imagesCfg.model,
          quality: FENG_4K_DEFAULT_QUALITY,
          referenceUrls: refs,
        },
        { keySlotIndex: params.fengKeySlotIndex }
      );
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
      console.warn("[outline-hd] GrsAI images/generations 4K empty");
    } catch (e) {
      console.warn(
        "[outline-hd] GrsAI images/generations 4K failed:",
        e instanceof Error ? e.message : e
      );
    }
  }

  console.warn(
    "[outline-hd] all images/generations 4K channels failed (Draw 不支持 vip 4K，已跳过)"
  );
  return { url: null, provider: "none", usedDrawFallback: false };
}
