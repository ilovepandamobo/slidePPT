import { getTemplateById, TEMPLATES } from "@/lib/templates-data";
import { renderSlideSvg, svgToDataUrl } from "@/lib/slide-renderer";
import { generateWithGrsai, GrsaiPollTimeoutError } from "@/lib/ai/grsai";
import {
  generateOutlineHdSlide,
  isOutlineHdGeneration,
} from "@/lib/ai/grsai-hd";
import {
  buildSlideGenerationPrompt,
  describePromptStrategy,
} from "@/lib/ai/prompts";
import { loadStyleReferenceForGrsai } from "@/lib/storage/style-reference";
import {
  parseImageQuality,
  resolveGrsaiDrawConfig,
} from "@/lib/ai/grsai-config";
import type { TemplateItem } from "@/types";

type SlideInput = {
  title: string;
  content: string;
  pageType: string;
  notes?: string | null;
  imageUrl?: string | null;
};

type GenerateOptions = {
  templateId?: string | null;
  stylePrompt?: string | null;
  styleReference?: string | null;
  styleToken?: string | null;
  watermark?: boolean;
  pageIndex: number;
  totalPages: number;
  aspectRatio?: string;
  imageQuality?: string | null;
  /** 重设计时传入当前页图片 */
  currentSlideImageUrl?: string | null;
  isRedesign?: boolean;
  isUploadReference?: boolean;
  /** 用户上传的修改参考图（与当前页原图一起发给模型） */
  uploadReferenceImageUrl?: string | null;
  /** 重设计/参考图：修改说明（不当作幻灯片正文渲染） */
  editInstructions?: string | null;
  /** 新页仅上传参考图、尚无成图时，只发这一张参考 */
  referenceOnlyImageUrl?: string | null;
  /** PPT 焕新：原稿截图路径 */
  layoutReferenceImageUrl?: string | null;
  isLayoutRemix?: boolean;
};

async function collectAllReferenceUrls(
  options: GenerateOptions
): Promise<string[]> {
  if (options.isLayoutRemix) {
    const urls: string[] = [];
    const add = async (stored: string | null | undefined) => {
      if (!stored) return;
      const refs = await loadStyleReferenceForGrsai(stored);
      for (const u of refs) {
        if (!urls.includes(u)) urls.push(u);
      }
      if (stored.startsWith("data:") && !urls.includes(stored)) {
        urls.push(stored);
      }
    };
    await add(options.styleReference);
    await add(options.layoutReferenceImageUrl);
    return urls.slice(0, 2);
  }

  if (options.referenceOnlyImageUrl) {
    const refs = await loadStyleReferenceForGrsai(
      options.referenceOnlyImageUrl
    );
    if (refs.length) return refs.slice(0, 1);
    if (options.referenceOnlyImageUrl.startsWith("data:")) {
      return [options.referenceOnlyImageUrl];
    }
    return refs;
  }

  /** 重设计 / 上传参考：不带全 deck 风格参考 */
  if (options.isUploadReference) {
    const urls: string[] = [];
    const add = async (stored: string | null | undefined) => {
      if (!stored) return;
      const refs = await loadStyleReferenceForGrsai(stored);
      for (const u of refs) {
        if (!urls.includes(u)) urls.push(u);
      }
      if (stored.startsWith("data:") && !urls.includes(stored)) {
        urls.push(stored);
      }
    };
    await add(options.currentSlideImageUrl);
    await add(options.uploadReferenceImageUrl);
    return urls.slice(0, 2);
  }

  if (options.isRedesign) {
    if (!options.currentSlideImageUrl) return [];
    const slideRefs = await loadStyleReferenceForGrsai(
      options.currentSlideImageUrl
    );
    if (slideRefs.length) return slideRefs.slice(0, 1);
    if (options.currentSlideImageUrl.startsWith("data:")) {
      return [options.currentSlideImageUrl];
    }
    return slideRefs;
  }

  const urls: string[] = [];
  const deckRefs = await loadStyleReferenceForGrsai(options.styleReference);
  urls.push(...deckRefs);
  return urls.slice(0, 4);
}

async function buildPromptContext(
  slide: SlideInput,
  template: TemplateItem,
  options: GenerateOptions
) {
  const referenceUrls = await collectAllReferenceUrls(options);
  const hasRef = referenceUrls.length > 0;

  return {
    prompt: buildSlideGenerationPrompt(
      {
        title: slide.title,
        content: slide.content,
        pageType: slide.pageType,
        notes: slide.notes,
      },
      {
        template,
        stylePrompt: options.stylePrompt,
        styleToken: options.styleToken,
        hasReferenceImage: hasRef,
        pageIndex: options.pageIndex,
        totalPages: options.totalPages,
        watermark: options.watermark,
        aspectRatio: options.aspectRatio,
        isRedesign: options.isRedesign,
        isUploadReference: options.isUploadReference,
        isLayoutRemix: options.isLayoutRemix,
        editInstructions: options.editInstructions,
      }
    ),
    referenceUrls,
    strategy: options.isLayoutRemix
      ? "PPT 焕新：图1风格，图2内容，仅重排版。"
      : options.isUploadReference
      ? "上传参考图：按参考图风格与右侧文案生成新幻灯片。"
      : options.isRedesign
        ? "重设计：当前页图片 + 修改说明（说明不会画到幻灯片上）。"
        : describePromptStrategy(
            hasRef,
            options.isRedesign,
            options.isLayoutRemix
          ),
  };
}

async function generateWithOpenAI(
  prompt: string
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1792x1024",
        quality: "hd",
        response_format: "url",
      }),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { url?: string }[] };
    return data.data?.[0]?.url ?? null;
  } catch {
    return null;
  }
}

export async function generateSlideImage(
  slide: SlideInput,
  options: GenerateOptions
): Promise<{
  imageUrl: string;
  usedAI: boolean;
  provider?: string;
  promptStrategy?: string;
}> {
  const template =
    getTemplateById(options.templateId || "") || TEMPLATES[0];
  const { prompt, referenceUrls, strategy } = await buildPromptContext(
    slide,
    template,
    options
  );

  const quality = parseImageQuality(options.imageQuality);
  const drawConfig = resolveGrsaiDrawConfig(options.aspectRatio, quality);
  const useOutlineHd = isOutlineHdGeneration(options);

  let grsaiUrl: string | null = null;
  let provider = quality === "hd" ? "grsai-vip-4k" : "grsai";

  try {
    if (useOutlineHd) {
      const hd = await generateOutlineHdSlide({
        prompt,
        referenceUrls: referenceUrls.length ? referenceUrls : undefined,
        aspectRatio: options.aspectRatio,
      });
      grsaiUrl = hd.url;
      provider = hd.provider;
      if (hd.usedDrawFallback && hd.url) {
        console.warn(
          "[generateSlideImage] 4K Feng AI unavailable, used Draw 1K fallback"
        );
      }
    } else {
      grsaiUrl = await generateWithGrsai({
        prompt,
        model: drawConfig.model,
        aspectRatio: drawConfig.aspectRatio,
        quality: "high",
        referenceUrls: referenceUrls.length ? referenceUrls : undefined,
      });
      provider = quality === "hd" ? "grsai-vip-4k" : "grsai";
    }
  } catch (e) {
    console.warn(
      "[generateSlideImage] GrsAI failed, trying fallback:",
      e instanceof Error ? e.message : e
    );
    if (quality === "hd") {
      if (e instanceof GrsaiPollTimeoutError) {
        throw new Error(
          `高清 4K 生成等待超时（约 ${e.waitedSec} 秒）。GrsAI 任务可能仍在处理，请 1–2 分钟后刷新页面查看，无需重复点击。`
        );
      }
      throw new Error(
        e instanceof Error
          ? `高清 4K 生成失败：${e.message}`
          : "高清 4K 生成失败，请稍后重试或改用标准画质"
      );
    }
  }
  if (grsaiUrl) {
    return {
      imageUrl: grsaiUrl,
      usedAI: true,
      provider,
      promptStrategy: strategy,
    };
  }

  if (quality === "hd") {
    throw new Error(
      useOutlineHd
        ? "高清 4K 未能获取图片（DALL·E 与 Draw 回退均失败）。请上传风格参考图后重试，或暂时改用标准画质。"
        : "高清 4K 未能获取图片（提交失败或接口无响应）。请检查 GrsAI 配置后重试，或暂时改用标准画质。"
    );
  }

  const openaiUrl = await generateWithOpenAI(prompt);
  if (openaiUrl) {
    const { persistRemoteImage } = await import("@/lib/ai/grsai");
    const persisted = await persistRemoteImage(openaiUrl);
    return {
      imageUrl: persisted,
      usedAI: true,
      provider: "openai",
      promptStrategy: strategy,
    };
  }

  const svg = renderSlideSvg({
    title: slide.title,
    content: slide.content,
    pageType: slide.pageType,
    pageIndex: options.pageIndex,
    totalPages: options.totalPages,
    template,
    stylePrompt: options.stylePrompt || undefined,
    watermark: options.watermark,
    customImageUrl: slide.imageUrl || undefined,
  });

  const { ensureStoredImageUrl } = await import("@/lib/storage/slide-image");
  const svgUrl = await ensureStoredImageUrl(svgToDataUrl(svg));

  return {
    imageUrl: svgUrl || svgToDataUrl(svg),
    usedAI: false,
    provider: "svg",
    promptStrategy: strategy,
  };
}

export function buildStyleToken(templateId: string, stylePrompt?: string) {
  return `${templateId}-${Buffer.from(stylePrompt || "").toString("base64").slice(0, 12)}`;
}
