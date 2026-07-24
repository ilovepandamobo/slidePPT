import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { resolveOutline } from "@/lib/outline/resolve";
import { buildStyleToken } from "@/lib/ai/generate";
import { resolveProjectStylePrompt } from "@/lib/ai/prompts";
import { getTemplateById } from "@/lib/templates-data";
import { persistStyleReference } from "@/lib/storage/style-reference";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1, "请填写演示文稿标题"),
  templateId: z.string().optional(),
  stylePrompt: z.string().nullish(),
  styleReference: z.string().nullish(),
  outlineRaw: z.string().optional(),
  aspectRatio: z.string().optional(),
  imageQuality: z.enum(["standard", "hd"]).optional(),
  audience: z.string().optional(),
  scene: z.string().optional(),
  generationMode: z.enum(["outline", "remix"]).optional(),
  pages: z
    .array(
      z.object({
        pageType: z.string(),
        title: z.string(),
        content: z.string(),
        notes: z.string().optional(),
        layoutReference: z.string().optional(),
      })
    )
    .optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    where: { userId: session.id },
    orderBy: { updatedAt: "desc" },
    include: {
      slides: { orderBy: { order: "asc" }, take: 1 },
      _count: { select: { slides: true } },
    },
  });

  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const json = await req.json();
    const body = createSchema.parse(json);

    const pages =
      body.pages && body.pages.length > 0
        ? body.pages
        : (
            await resolveOutline(body.outlineRaw || "")
          ).pages.map((p) => ({
            pageType: p.pageType,
            title: p.title,
            content: p.content,
            notes: p.notes,
          }));

    if (pages.length === 0) {
      return NextResponse.json(
        {
          error:
            body.generationMode === "remix"
              ? "请至少上传一页原稿截图"
              : "大纲为空，请先填写内容并点击「智能分页预览」",
        },
        { status: 400 }
      );
    }

    if (body.generationMode === "remix") {
      if (!body.styleReference) {
        return NextResponse.json(
          { error: "PPT 焕新需要上传目标风格参考图" },
          { status: 400 }
        );
      }
      const missingRef = pages.some(
        (p) => !("layoutReference" in p && p.layoutReference)
      );
      if (missingRef) {
        return NextResponse.json(
          { error: "每页都需要对应的原稿截图" },
          { status: 400 }
        );
      }
    }

    let styleReferenceStored: string | null = body.styleReference || null;
    if (styleReferenceStored?.startsWith("data:")) {
      const saved = await persistStyleReference(styleReferenceStored);
      styleReferenceStored = saved.path;
    }
    // 已是 /api/files/... 则直接存路径（上传接口已落盘原图）

    const templateStyle = body.templateId
      ? getTemplateById(body.templateId)?.stylePrompt
      : undefined;
    const stylePrompt = resolveProjectStylePrompt(
      styleReferenceStored,
      body.stylePrompt ?? undefined,
      templateStyle
    );

    const styleToken = styleReferenceStored
      ? `ref-${styleReferenceStored.replace(/[^a-zA-Z0-9]/g, "").slice(-20)}`
      : buildStyleToken(body.templateId || "midnight-pro", stylePrompt || undefined);

    const project = await prisma.project.create({
      data: {
        title: body.title,
        userId: session.id,
        ...(body.templateId ? { templateId: body.templateId } : {}),
        stylePrompt,
        styleReference: styleReferenceStored,
        outlineRaw: body.outlineRaw,
        aspectRatio: body.aspectRatio || "16:9",
        imageQuality: body.imageQuality || "standard",
        ...(body.audience ? { audience: body.audience } : {}),
        ...(body.scene ? { scene: body.scene } : {}),
        generationMode: body.generationMode || "outline",
        styleToken,
        watermark: session.plan === "free",
        slides: {
          create: pages.map((p, i) => ({
            order: i,
            pageType: p.pageType,
            title: p.title,
            content: p.content,
            notes: p.notes,
            layoutReference:
              "layoutReference" in p ? p.layoutReference : undefined,
            status: "pending",
          })),
        },
      },
      include: { slides: { orderBy: { order: "asc" } } },
    });

    return NextResponse.json({ project });
  } catch (e) {
    if (e instanceof z.ZodError) {
      const msg = e.issues.map((i) => i.message).join("；") || "参数无效";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error("[POST /api/projects]", e);
    const message =
      e instanceof Error ? e.message : "创建失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
