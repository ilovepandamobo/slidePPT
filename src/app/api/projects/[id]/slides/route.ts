import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

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
    include: { slides: true },
  });
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  const body = await req.json();
  const maxOrder = Math.max(-1, ...project.slides.map((s) => s.order));
  const insertAt: number = body.order ?? maxOrder + 1;

  await prisma.slide.updateMany({
    where: { projectId: id, order: { gte: insertAt } },
    data: { order: { increment: 1 } },
  });

  const slide = await prisma.slide.create({
    data: {
      projectId: id,
      order: insertAt,
      pageType: body.pageType || "content",
      title: body.title || "新页面",
      content: body.content || "",
      notes: body.notes,
      status: "pending",
    },
  });

  return NextResponse.json({ slide });
}

export async function PUT(
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

  const { slideIds } = (await req.json()) as { slideIds: string[] };
  for (let i = 0; i < slideIds.length; i++) {
    await prisma.slide.update({
      where: { id: slideIds[i] },
      data: { order: i },
    });
  }

  const slides = await prisma.slide.findMany({
    where: { projectId: id },
    orderBy: { order: "asc" },
  });

  return NextResponse.json({ slides });
}
