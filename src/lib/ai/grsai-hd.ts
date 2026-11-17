/**
 * 高清 4K 链路（默认）：
 * 1. GrsAI POST /v1/api/generate（GRSAI_API_KEY，vip / flare / sunburst，4K 像素）
 * 2. 失败 → 乘丰 api.cphone.vip /v1/images/generations（GRSAI_IMAGES_*）
 * 设 HD_IMAGES_PREFER_FENG=true 可恢复「先乘丰后 GrsAI」。
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

export type HdImageChannel = "auto" | "grsai-only" | "feng-only";

function preferFeng4KFirst(): boolean {
  return process.env.HD_IMAGES_PREFER_FENG === "true";
}

/** 项目设为 hd 时走 4K 双通道（含编辑器重设计、上传参考修改） */
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
  label: string,
  channel: HdImageChannel
): Promise<OutlineHdResult | null> {
  console.info(`[outline-hd] ${label} refs=${refs.length}`);

  const imageParams = {
    prompt,
    size: imagesCfg.size,
    model: imagesCfg.model,
    quality: FENG_4K_DEFAULT_QUALITY,
    referenceUrls: refs,
  };

  const tryGrsai = async (): Promise<OutlineHdResult | null> => {
    try {
      const grsai4k = await generateWithGrsaiPlatformImages(imageParams, {
        keySlotIndex: fengKeySlotIndex,
      });
      if (grsai4k) {
        return {
          url: grsai4k,
          provider: "grsai-generate-4k",
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
  };

  const tryFeng = async (
    usedDrawFallback: boolean
  ): Promise<OutlineHdResult | null> => {
    try {
      const fengUrl = await generateWithGrsaiImages(imageParams, {
        keySlotIndex: fengKeySlotIndex,
      });
      if (fengUrl) {
        return { url: fengUrl, provider: "feng-ai-4k", usedDrawFallback };
      }
      console.warn(`[outline-hd] ${label} Feng empty`);
    } catch (e) {
      console.warn(
        `[outline-hd] ${label} Feng failed:`,
        e instanceof Error ? e.message : e
      );
    }
    return null;
  };

  if (channel === "grsai-only") {
    return tryGrsai();
  }
  if (channel === "feng-only") {
    return tryFeng(true);
  }

  const grsaiFirst = !preferFeng4KFirst();
  const first = grsaiFirst ? tryGrsai : () => tryFeng(false);
  const second = grsaiFirst
    ? () => tryFeng(true)
    : () => tryGrsai().then((r) =>
        r
          ? { ...r, usedDrawFallback: true }
          : null
      );

  const primary = await first();
  if (primary?.url) return primary;

  console.warn(
    `[outline-hd] ${label} ${grsaiFirst ? "GrsAI" : "Feng"} empty → ${
      grsaiFirst ? "Feng" : "GrsAI"
    } 4K`
  );
  return second();
}

export async function generateOutlineHdSlide(params: {
  prompt: string;
  referenceUrls?: string[];
  aspectRatio?: string;
  fengKeySlotIndex?: number;
  channel?: HdImageChannel;
}): Promise<OutlineHdResult> {
  const imagesCfg = resolveGrsaiImagesConfig(params.aspectRatio);
  const refs = params.referenceUrls?.length ? params.referenceUrls : undefined;
  const channel = params.channel ?? "auto";

  if (!refs?.length) {
    if (channel === "feng-only") {
      const url = await generateWithGrsaiImages(
        {
          prompt: params.prompt,
          size: imagesCfg.size,
          model: imagesCfg.model,
          quality: FENG_4K_DEFAULT_QUALITY,
          referenceUrls: [],
        },
        { keySlotIndex: params.fengKeySlotIndex }
      );
      return {
        url,
        provider: url ? "feng-ai-4k" : "none",
        usedDrawFallback: false,
      };
    }
    console.warn("[outline-hd] no reference images, GrsAI /v1/api/generate 4K");
    const url = await generateWithGrsaiPlatformImages(
      {
        prompt: params.prompt,
        size: imagesCfg.size,
        model: imagesCfg.model,
        quality: FENG_4K_DEFAULT_QUALITY,
        referenceUrls: [],
      },
      { keySlotIndex: params.fengKeySlotIndex }
    );
    return {
      url,
      provider: url ? "grsai-generate-4k" : "none",
      usedDrawFallback: false,
    };
  }

  const dual = await runHdImagesChannels(
    params.prompt,
    refs,
    imagesCfg,
    params.fengKeySlotIndex,
    "dual-image",
    channel
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
      "single-image-fallback",
      channel
    );
    if (single?.url) {
      return {
        ...single,
        provider: `${single.provider}-single-ref`,
      };
    }
  }

  console.warn("[outline-hd] GrsAI and Feng 4K both failed");
  return { url: null, provider: "none", usedDrawFallback: false };
}
