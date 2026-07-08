import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { buildPptx } from "@/lib/export/pptx";
import { buildPdf } from "@/lib/export/pdf";

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

  const { format } = (await req.json()) as { format: "pptx" | "pdf" | "png" };
  const { resolveImageForExport } = await import("@/lib/storage/slide-image");
  const slides = await Promise.all(
    project.slides
      .filter((s) => s.imageUrl)
      .map(async (s) => ({
        imageUrl: await resolveImageForExport(s.imageUrl!),
        title: s.title,
      }))
  );

  if (slides.length === 0) {
    return NextResponse.json({ error: "请先生成幻灯片" }, { status: 400 });
  }

  if (format === "pdf") {
    const buffer = await buildPdf(project.title, slides, project.aspectRatio);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(project.title)}.pdf"`,
      },
    });
  }

  const buffer = await buildPptx(project.title, slides, project.aspectRatio);
  const ext = format === "pptx" ? "pptx" : "pptx";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(project.title)}.${ext}"`,
    },
  });
}
