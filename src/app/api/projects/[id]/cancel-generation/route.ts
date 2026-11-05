import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { syncProjectStatus } from "@/lib/project-status";

/**
 * 解除「生成中」锁定（不中断 Railway 上可能仍在跑的上游请求）。
 * 有成图则回到 done，否则 pending。
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.id },
    include: { slides: true },
  });
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const slideId = body.slideId as string | undefined;

  const targets = slideId
    ? project.slides.filter((s) => s.id === slideId)
    : project.slides.filter((s) => s.status === "generating");

  if (slideId && targets.length === 0) {
    return NextResponse.json({ error: "页面不存在" }, { status: 404 });
  }

  const cancelled: string[] = [];
  for (const slide of targets) {
    if (slide.status !== "generating") continue;
    const nextStatus = slide.imageUrl ? "done" : "pending";
    await prisma.slide.update({
      where: { id: slide.id },
      data: { status: nextStatus },
    });
    cancelled.push(slide.id);
  }

  await prisma.generationJob.updateMany({
    where: { projectId, status: "running" },
    data: {
      status: "cancelled",
      error: "用户停止等待",
    },
  });

  await syncProjectStatus(projectId);

  const updated = await prisma.project.findUnique({
    where: { id: projectId },
    include: { slides: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json({
    ok: true,
    cancelledCount: cancelled.length,
    cancelledSlideIds: cancelled,
    project: updated,
  });
}
