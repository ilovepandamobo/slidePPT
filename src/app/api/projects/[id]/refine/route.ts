import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { refineDeckPrompt } from "@/lib/ai/assist";

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

  const { instruction } = await req.json();
  const styleAddition = await refineDeckPrompt(
    instruction,
    project.slides.map((s) => ({
      pageType: s.pageType as "content",
      title: s.title,
      content: s.content,
    }))
  );

  const updated = await prisma.project.update({
    where: { id },
    data: {
      stylePrompt: [project.stylePrompt, styleAddition].filter(Boolean).join(". "),
    },
  });

  return NextResponse.json({ project: updated, styleAddition });
}
