import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function getOwnedProject(id: string, userId: string) {
  return prisma.project.findFirst({
    where: { id, userId },
    include: { slides: { orderBy: { order: "asc" } } },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const project = await getOwnedProject(id, session.id);
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }
  return NextResponse.json({ project });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const project = await getOwnedProject(id, session.id);
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  const body = await req.json();
  const updated = await prisma.project.update({
    where: { id },
    data: {
      title: body.title,
      stylePrompt: body.stylePrompt,
      templateId: body.templateId,
      audience: body.audience,
      scene: body.scene,
      outlineRaw: body.outlineRaw,
      imageQuality: body.imageQuality,
      aspectRatio: body.aspectRatio,
      status: body.status,
    },
    include: { slides: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json({ project: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const project = await getOwnedProject(id, session.id);
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
