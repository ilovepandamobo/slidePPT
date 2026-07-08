import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { generateToken } from "@/lib/utils";

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
  });
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  const body = await req.json();
  const token = project.shareToken || generateToken(24);

  await prisma.project.update({
    where: { id },
    data: {
      shareToken: token,
      sharePassword: body.password || null,
      shareExpiresAt: body.expiresInDays
        ? new Date(Date.now() + body.expiresInDays * 86400000)
        : null,
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return NextResponse.json({
    shareUrl: `${baseUrl}/share/${token}`,
    token,
  });
}
