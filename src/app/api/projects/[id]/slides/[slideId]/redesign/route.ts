import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { generateSlideImage } from "@/lib/ai/generate";
import {
  parseImageHistory,
  pushImageToHistory,
  serializeImageHistory,
} from "@/lib/slide-image-history";
import { ensureStoredImageUrl } from "@/lib/storage/slide-image";

export const maxDuration = 600;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; slideId: string }> }
) {
  const { id, slideId } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const project = await prisma.project.findFirst({
    where: { id, userId: session.id },
    include: { slides: { orderBy: { order: "asc" } } },
  });
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  const existing = project.slides.find((s) => s.id === slideId);
  if (!existing) {
    return NextResponse.json({ error: "页面不存在" }, { status: 404 });
  }

  if (existing.status === "generating") {
    return NextResponse.json(
      { error: "该页正在生成中，请勿重复提交" },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const title = (body.title as string) ?? existing.title;
  const referenceImageUrl = body.referenceImageUrl as string | undefined;
  const fromUpload = Boolean(referenceImageUrl);
  const editInstructions = (
    (body.editInstructions as string) ??
    (body.content as string) ??
    ""
  ).trim();

  /** 修改说明不写进 content，避免下次生成把说明当正文 */
  await prisma.slide.update({
    where: { id: slideId },
    data: { status: "generating", title },
  });

  try {
    let history = parseImageHistory(existing.imageHistory);
    const storedCurrent = await ensureStoredImageUrl(existing.imageUrl);
    if (storedCurrent) {
      history = pushImageToHistory(
        history,
        storedCurrent,
        fromUpload
          ? "生成前版本"
          : `版本 ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`
      );
    }

    const storedRef = fromUpload
      ? await ensureStoredImageUrl(referenceImageUrl)
      : null;
    if (fromUpload && !storedRef) {
      throw new Error("参考图保存失败");
    }

    const { imageUrl: generatedUrl, provider } = await generateSlideImage(
      {
        title,
        content: existing.content,
        pageType: existing.pageType,
        notes: existing.notes,
        imageUrl: storedCurrent || existing.imageUrl,
      },
      {
        templateId: project.templateId,
        stylePrompt: project.stylePrompt,
        styleReference: project.styleReference,
        styleToken: project.styleToken,
        watermark: project.watermark,
        pageIndex: existing.order,
        totalPages: project.slides.length,
        aspectRatio: project.aspectRatio,
        imageQuality: project.imageQuality,
        currentSlideImageUrl: storedCurrent || existing.imageUrl,
        uploadReferenceImageUrl: fromUpload ? storedRef : null,
        isRedesign: !fromUpload,
        isUploadReference: fromUpload,
        editInstructions,
      }
    );

    const imageUrl = await ensureStoredImageUrl(generatedUrl);
    if (!imageUrl) {
      throw new Error("生成图片保存失败");
    }

    for (let i = 0; i < history.length; i++) {
      const stored = await ensureStoredImageUrl(history[i].imageUrl);
      if (stored) history[i] = { ...history[i], imageUrl: stored };
    }

    const updated = await prisma.slide.update({
      where: { id: slideId },
      data: {
        title,
        imageUrl,
        imageHistory: serializeImageHistory(history),
        status: "done",
      },
    });

    return NextResponse.json({
      slide: updated,
      imageHistory: history,
      provider,
    });
  } catch (e) {
    await prisma.slide.update({
      where: { id: slideId },
      data: { status: "done" },
    });
    const message = e instanceof Error ? e.message : "重新设计失败";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
