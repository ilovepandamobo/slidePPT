import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ensureStoredImageUrl } from "@/lib/storage/slide-image";
import {
  parseImageHistory,
  pushImageToHistory,
  serializeImageHistory,
} from "@/lib/slide-image-history";

/** 直接替换当前页图片（上传），旧图进历史，不触发 AI 重生成 */
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

  const { imageUrl: raw } = (await req.json()) as { imageUrl: string };
  if (!raw) {
    return NextResponse.json({ error: "缺少图片地址" }, { status: 400 });
  }

  const imageUrl = await ensureStoredImageUrl(raw);
  if (!imageUrl) {
    return NextResponse.json({ error: "图片保存失败" }, { status: 400 });
  }

  let history = parseImageHistory(slide.imageHistory);
  const storedOld = await ensureStoredImageUrl(slide.imageUrl);
  if (storedOld && storedOld !== imageUrl) {
    history = pushImageToHistory(history, storedOld, "上传前版本");
  }

  const updated = await prisma.slide.update({
    where: { id: slideId },
    data: {
      imageUrl,
      imageHistory: serializeImageHistory(history),
      status: "done",
    },
  });

  return NextResponse.json({
    slide: updated,
    imageHistory: history,
  });
}
