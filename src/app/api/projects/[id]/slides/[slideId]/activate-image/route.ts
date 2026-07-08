import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  parseImageHistory,
  pushImageToHistory,
  serializeImageHistory,
} from "@/lib/slide-image-history";
import { ensureStoredImageUrl } from "@/lib/storage/slide-image";

/** 切换到历史版本：当前图入历史，选中历史图变为当前 */
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
  });
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  const slide = await prisma.slide.findFirst({
    where: { id: slideId, projectId: id },
  });
  if (!slide) {
    return NextResponse.json({ error: "页面不存在" }, { status: 404 });
  }

  const { variantId } = (await req.json()) as { variantId: string };
  let history = parseImageHistory(slide.imageHistory);
  const target = history.find((h) => h.id === variantId);
  if (!target) {
    return NextResponse.json({ error: "版本不存在" }, { status: 404 });
  }

  history = history.filter((h) => h.id !== variantId);
  const storedCurrent = await ensureStoredImageUrl(slide.imageUrl);
  if (storedCurrent) {
    history = pushImageToHistory(history, storedCurrent, "当前版本");
  }

  const imageUrl = await ensureStoredImageUrl(target.imageUrl);
  if (!imageUrl) {
    return NextResponse.json({ error: "图片无效" }, { status: 400 });
  }

  for (let i = 0; i < history.length; i++) {
    const stored = await ensureStoredImageUrl(history[i].imageUrl);
    if (stored) history[i] = { ...history[i], imageUrl: stored };
  }

  const updated = await prisma.slide.update({
    where: { id: slideId },
    data: {
      imageUrl,
      imageHistory: serializeImageHistory(history),
    },
  });

  return NextResponse.json({
    slide: updated,
    imageHistory: parseImageHistory(updated.imageHistory),
  });
}
