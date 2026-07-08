import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const project = await prisma.project.findUnique({
    where: { shareToken: token },
    include: { slides: { orderBy: { order: "asc" } } },
  });

  if (!project) {
    return NextResponse.json({ error: "链接无效" }, { status: 404 });
  }

  if (project.shareExpiresAt && project.shareExpiresAt < new Date()) {
    return NextResponse.json({ error: "链接已过期" }, { status: 410 });
  }

  const { searchParams } = new URL(req.url);
  const password = searchParams.get("password");
  if (project.sharePassword && project.sharePassword !== password) {
    return NextResponse.json({ error: "需要密码", requiresPassword: true }, { status: 403 });
  }

  return NextResponse.json({
    project: {
      title: project.title,
      aspectRatio: project.aspectRatio,
      slides: project.slides.map((s) => ({
        id: s.id,
        title: s.title,
        imageUrl: s.imageUrl,
        order: s.order,
      })),
    },
  });
}
