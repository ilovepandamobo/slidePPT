import { NextResponse } from "next/server";
import {
  suggestPageSplit,
  estimateDuration,
  hasExplicitPageMarkers,
} from "@/lib/outline";
import { resolveOutline } from "@/lib/outline/resolve";
import { z } from "zod";

const schema = z.object({
  outline: z.string(),
  autoSplit: z.boolean().optional(),
  forceNormalize: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const resolved = await resolveOutline(body.outline, {
      forceLlm: body.forceNormalize,
    });

    if (resolved.pages.length === 0) {
      return NextResponse.json(
        {
          error:
            "无法识别大纲，请使用「第1页：标题」「第一页 标题」或 # 标题 格式",
        },
        { status: 400 }
      );
    }

    let pages = resolved.pages;
    const strict =
      resolved.strictPageBoundaries ||
      hasExplicitPageMarkers(body.outline) ||
      resolved.source === "llm";

    if (body.autoSplit && !strict) {
      pages = suggestPageSplit(pages);
    }

    const duration = estimateDuration(pages);
    return NextResponse.json({
      pages,
      duration,
      pageCount: pages.length,
      suggestedTitle: resolved.suggestedTitle,
      strictPageBoundaries: strict,
      source: resolved.source,
      confidence: resolved.confidence,
      warnings: resolved.warnings.length ? resolved.warnings : undefined,
    });
  } catch {
    return NextResponse.json({ error: "解析失败" }, { status: 400 });
  }
}
