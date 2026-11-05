import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { generateSlideImage } from "@/lib/ai/generate";
import { syncProjectStatus } from "@/lib/project-status";

export async function PATCH(
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

  const body = await req.json();

  const existing = project.slides.find((s) => s.id === slideId);
  if (!existing) {
    return NextResponse.json({ error: "页面不存在" }, { status: 404 });
  }

  if (body.cancelGeneration === true) {
    const nextStatus =
      existing.status === "generating"
        ? existing.imageUrl
          ? "done"
          : "pending"
        : existing.status;
    const updated = await prisma.slide.update({
      where: { id: slideId },
      data: { status: nextStatus },
    });
    await syncProjectStatus(id);
    return NextResponse.json({ slide: updated, cancelled: existing.status === "generating" });
  }

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.content !== undefined) data.content = body.content;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.pageType !== undefined) data.pageType = body.pageType;
  if (body.layout !== undefined) data.layout = body.layout;
  if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl;

  const slide = await prisma.slide.update({
    where: { id: slideId },
    data,
  });

  if (body.regenerate) {
    const { ensureStoredImageUrl } = await import("@/lib/storage/slide-image");
    const { imageUrl: rawUrl } = await generateSlideImage(
      {
        title: slide.title,
        content: slide.content,
        pageType: slide.pageType,
        imageUrl: body.customImage || slide.imageUrl,
      },
      {
        templateId: project.templateId,
        stylePrompt: project.stylePrompt,
        styleReference: project.styleReference,
        styleToken: project.styleToken,
        watermark: project.watermark,
        pageIndex: slide.order,
        totalPages: project.slides.length,
        aspectRatio: project.aspectRatio,
        imageQuality: project.imageQuality,
      }
    );
    const imageUrl = (await ensureStoredImageUrl(rawUrl)) || rawUrl;
    const updated = await prisma.slide.update({
      where: { id: slideId },
      data: { imageUrl, status: "done" },
    });
    return NextResponse.json({ slide: updated });
  }

  return NextResponse.json({ slide });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; slideId: string }> }
) {
  const { id, slideId } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const project = await prisma.project.findFirst({
    where: { id, userId: session.id },
  });
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  const deleted = await prisma.slide.findUnique({ where: { id: slideId } });
  if (!deleted) {
    return NextResponse.json({ error: "页面不存在" }, { status: 404 });
  }

  await prisma.slide.delete({ where: { id: slideId } });

  const remaining = await prisma.slide.findMany({
    where: { projectId: id },
    orderBy: { order: "asc" },
  });
  for (let i = 0; i < remaining.length; i++) {
    await prisma.slide.update({
      where: { id: remaining[i].id },
      data: { order: i },
    });
  }

  return NextResponse.json({ ok: true });
}
