import { NextResponse } from "next/server";
import {
  parseOutline,
  suggestPageSplit,
  estimateDuration,
  inferPresentationTitle,
  hasExplicitPageMarkers,
} from "@/lib/outline";
import { z } from "zod";

const schema = z.object({
  outline: z.string(),
  autoSplit: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    let pages = parseOutline(body.outline);
    if (pages.length === 0) {
      return NextResponse.json(
        {
          error:
            "无法识别大纲，请使用「第1页：标题」「第一页 标题」或 # 标题 格式",
        },
        { status: 400 }
      );
    }
    const strict = hasExplicitPageMarkers(body.outline);
    if (body.autoSplit && !strict) {
      pages = suggestPageSplit(pages);
    }
    const duration = estimateDuration(pages);
    const suggestedTitle = inferPresentationTitle(pages, body.outline);
    return NextResponse.json({
      pages,
      duration,
      pageCount: pages.length,
      suggestedTitle,
      strictPageBoundaries: strict,
    });
  } catch {
    return NextResponse.json({ error: "解析失败" }, { status: 400 });
  }
}
