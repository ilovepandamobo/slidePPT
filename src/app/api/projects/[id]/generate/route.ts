import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { generateSlideImage } from "@/lib/ai/generate";
import {
  getGenerationConcurrency,
  mapWithConcurrency,
} from "@/lib/generation-concurrency";

/** VIP 4K 单页可能 2–7 分钟，多页并发取最慢一页 */
export const maxDuration = 600;

type SlideRow = {
  id: string;
  order: number;
  title: string;
  content: string;
  pageType: string;
  notes: string | null;
  imageUrl: string | null;
  status: string;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const proj = project;

  const body = await req.json().catch(() => ({}));
  const slideIds: string[] | undefined = body.slideIds;
  const anchorOnly: boolean = body.anchorOnly === true;
  const referenceImageUrl = body.referenceImageUrl as string | undefined;

  const slidesToGenerate: SlideRow[] = slideIds?.length
    ? proj.slides.filter((s) => slideIds.includes(s.id))
    : anchorOnly && proj.slides[0]
      ? [proj.slides[0]]
      : proj.slides;

  if (slidesToGenerate.length === 0) {
    return NextResponse.json({ error: "没有可生成的页面" }, { status: 400 });
  }

  if (
    slideIds?.length === 1 &&
    slidesToGenerate.some((s) => s.status === "generating")
  ) {
    return NextResponse.json(
      { error: "该页正在生成中，请勿重复提交" },
      { status: 409 }
    );
  }

  const creditCost = slidesToGenerate.length;
  if (session.credits < creditCost && session.plan === "free") {
    return NextResponse.json({ error: "额度不足，请升级套餐" }, { status: 402 });
  }

  const job = await prisma.generationJob.create({
    data: {
      projectId: id,
      status: "running",
      progress: 0,
      total: slidesToGenerate.length,
    },
  });

  await prisma.project.update({
    where: { id },
    data: { status: "generating" },
  });

  const total = proj.slides.length;
  let completed = 0;
  const concurrency = getGenerationConcurrency(slidesToGenerate.length);
  const failures: { order: number; title: string; error: string }[] = [];

  const { ensureStoredImageUrl } = await import("@/lib/storage/slide-image");
  let storedUploadRef: string | null = null;
  if (referenceImageUrl && slidesToGenerate.length === 1) {
    storedUploadRef = await ensureStoredImageUrl(referenceImageUrl);
  }

  async function generateOne(slide: SlideRow) {
    await prisma.slide.update({
      where: { id: slide.id },
      data: { status: "generating" },
    });

    try {
      const useRefOnly = Boolean(storedUploadRef && !slide.imageUrl);

      const { imageUrl: rawUrl } = await generateSlideImage(
        {
          title: slide.title,
          content: slide.content,
          pageType: slide.pageType,
          notes: slide.notes,
          imageUrl: slide.imageUrl,
        },
        {
          templateId: proj.templateId,
          stylePrompt: proj.stylePrompt,
          styleReference: useRefOnly ? null : proj.styleReference,
          styleToken: proj.styleToken,
          watermark: proj.watermark,
          pageIndex: slide.order,
          totalPages: total,
          aspectRatio: proj.aspectRatio,
          imageQuality: proj.imageQuality,
          referenceOnlyImageUrl: useRefOnly ? storedUploadRef : null,
        }
      );

      const imageUrl = (await ensureStoredImageUrl(rawUrl)) || rawUrl;

      await prisma.slide.update({
        where: { id: slide.id },
        data: { imageUrl, status: "done" },
      });

      completed++;
      await prisma.generationJob.update({
        where: { id: job.id },
        data: { progress: completed },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "本页生成失败";
      await prisma.slide.update({
        where: { id: slide.id },
        data: { status: "failed" },
      });
      failures.push({
        order: slide.order + 1,
        title: slide.title,
        error: msg,
      });
    }
  }

  await mapWithConcurrency(slidesToGenerate, concurrency, generateOne);

  const updated = await prisma.project.findUnique({
    where: { id },
    include: { slides: { orderBy: { order: "asc" } } },
  });

  if (failures.length === slidesToGenerate.length) {
    const msg =
      failures.map((f) => `第${f.order}页「${f.title}」: ${f.error}`).join("\n") ||
      "全部页面生成失败";
    await prisma.generationJob.update({
      where: { id: job.id },
      data: { status: "failed", error: msg, progress: 0 },
    });
    await prisma.project.update({
      where: { id },
      data: { status: "draft" },
    });
    return NextResponse.json({ error: msg, failures }, { status: 502 });
  }

  if (session.plan === "free" && creditCost > 0) {
    const charged = slidesToGenerate.length - failures.length;
    if (charged > 0) {
      await prisma.user.update({
        where: { id: session.id },
        data: { credits: { decrement: charged } },
      });
    }
  }

  await prisma.generationJob.update({
    where: { id: job.id },
    data: {
      status: failures.length ? "completed_with_errors" : "completed",
      progress: completed,
      error:
        failures.length > 0
          ? failures.map((f) => `第${f.order}页: ${f.error}`).join("; ")
          : null,
    },
  });

  await prisma.project.update({
    where: { id },
    data: { status: "ready" },
  });

  return NextResponse.json({
    project: updated,
    jobId: job.id,
    parallel: true,
    concurrency,
    failures: failures.length ? failures : undefined,
    partial: failures.length > 0,
  });
}
