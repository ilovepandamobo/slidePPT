import {
  grsaiChatCompletion,
  getOutlineChatModel,
  isGrsaiChatConfigured,
} from "@/lib/ai/grsai-chat";
import {
  OUTLINE_REFINE_SYSTEM_PROMPT,
  buildRuleRefineUserPrompt,
} from "@/lib/outline/prompts";
import type { LlmNormalizeOutcome } from "@/lib/outline/llm-normalize";
import type { OutlinePage, PageType } from "@/types";
import { z } from "zod";

const RefinePageSchema = z.object({
  pageIndex: z.number().int().min(1),
  pageType: z.enum([
    "cover",
    "toc",
    "section",
    "content",
    "data",
    "image",
    "ending",
    "qa",
  ]),
  title: z.string().min(1).max(200),
  notes: z.string().optional(),
});

const RefineResponseSchema = z.object({
  presentationTitle: z.string().optional(),
  pages: z.array(RefinePageSchema).min(1).max(80),
});

function extractJson(text: string): unknown | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fenced?.[1]?.trim() ?? trimmed;
  const start = jsonText.indexOf("{");
  const end = jsonText.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(jsonText.slice(start, end + 1));
  } catch {
    return null;
  }
}

function mergeRefined(
  rulePages: OutlinePage[],
  refined: z.infer<typeof RefineResponseSchema>
): OutlinePage[] {
  return rulePages.map((p, i) => {
    const byIndex = refined.pages.find((r) => r.pageIndex === i + 1);
    const r = byIndex ?? refined.pages[i];
    if (!r) return p;
    return {
      ...p,
      title: r.title.trim() || p.title,
      pageType: r.pageType as PageType,
      notes: r.notes?.trim() || p.notes,
    };
  });
}

const REFINE_TIMEOUT_MS =
  Number(process.env.GRSAI_CHAT_REFINE_TIMEOUT_MS) || 120_000;

/** 长稿已规则分页时：只让 LLM 校标题/类型，避免输出整本 JSON 超时 */
export async function refineRulePagesWithLlm(
  raw: string,
  rulePages: OutlinePage[]
): Promise<LlmNormalizeOutcome> {
  if (!isGrsaiChatConfigured()) {
    return {
      ok: false,
      failure: {
        failReason: "not_configured",
        failDetail: "未配置 GRSAI_API_KEY",
        chatCalls: 0,
      },
    };
  }

  console.info(
    "[outline-llm] rule-guided refine",
    rulePages.length,
    "pages"
  );

  const content = await grsaiChatCompletion({
    messages: [
      { role: "system", content: OUTLINE_REFINE_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildRuleRefineUserPrompt(raw, rulePages),
      },
    ],
    model: getOutlineChatModel(),
    jsonMode: true,
    maxTokens: Math.min(8000, 200 + rulePages.length * 120),
    temperature: 0,
    timeoutMs: REFINE_TIMEOUT_MS,
  });

  if (!content) {
    return {
      ok: false,
      failure: {
        failReason: "chat_empty",
        failDetail: "AI 精炼无响应（仍可继续使用规则分页）",
        chatCalls: 1,
      },
    };
  }

  const parsed = RefineResponseSchema.safeParse(extractJson(content));
  if (!parsed.success) {
    return {
      ok: false,
      failure: {
        failReason: "parse_failed",
        failDetail: "AI 精炼返回不是合法 JSON",
        chatCalls: 1,
      },
    };
  }

  if (parsed.data.pages.length !== rulePages.length) {
    return {
      ok: false,
      failure: {
        failReason: "validation_failed",
        failDetail: `AI 返回 ${parsed.data.pages.length} 页，与规则 ${rulePages.length} 页不一致`,
        chatCalls: 1,
      },
    };
  }

  return {
    ok: true,
    chatCalls: 1,
    data: {
      pages: mergeRefined(rulePages, parsed.data),
      presentationTitle: parsed.data.presentationTitle?.trim(),
      warnings: ["llm_refine_metadata"],
    },
  };
}