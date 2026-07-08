import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { refineDeckPrompt } from "@/lib/ai/assist";

/** 将调整说明应用到全 deck 各页，供随后批量重生成 */
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

  const { instruction } = (await req.json()) as { instruction?: string };
  const text = instruction?.trim();
  if (!text) {
    return NextResponse.json({ error: "请填写调整说明" }, { status: 400 });
  }

  const styleAddition = await refineDeckPrompt(
    text,
    project.slides.map((s) => ({
      pageType: s.pageType as "content",
      title: s.title,
      content: s.content,
    }))
  );

  const deckNote = `全 deck 调整：${text}`;

  for (const slide of project.slides) {
    const notes = slide.notes?.includes(deckNote)
      ? slide.notes
      : slide.notes
        ? `${deckNote}\n${slide.notes}`
        : deckNote;
    await prisma.slide.update({
      where: { id: slide.id },
      data: { notes },
    });
  }

  const updated = await prisma.project.update({
    where: { id },
    data: {
      stylePrompt: [project.stylePrompt, styleAddition || text]
        .filter(Boolean)
        .join(". "),
    },
    include: { slides: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json({ project: updated, styleAddition });
}
