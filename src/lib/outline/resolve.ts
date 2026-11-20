import {
  parseOutline,
  normalizeOutlineInput,
  inferPresentationTitle,
  countExplicitPageMarkers,
} from "@/lib/outline";
import {
  scoreOutlineConfidence,
  shouldUseLlmNormalize,
  isSuspiciousRuleSplit,
} from "@/lib/outline/confidence";
import { normalizeOutlineWithLlm } from "@/lib/outline/llm-normalize";
import { splitOutlineRawIntoPageBlocks } from "@/lib/outline";
import type { OutlinePage } from "@/types";

export type OutlineResolveSource = "rules" | "llm";

export type OutlineResolveResult = {
  pages: OutlinePage[];
  source: OutlineResolveSource;
  confidence: number;
  warnings: string[];
  outlineRaw: string;
  suggestedTitle: string;
  strictPageBoundaries: boolean;
  /** 用户强制 AI 识别但 LLM 未产出可用结果 */
  llmFailed?: boolean;
  llmError?: string;
};

export type ResolveOutlineOptions = {
  forceLlm?: boolean;
  skipLlm?: boolean;
  minConfidence?: number;
};

export async function resolveOutline(
  raw: string,
  options?: ResolveOutlineOptions
): Promise<OutlineResolveResult> {
  const outlineRaw = normalizeOutlineInput(raw);
  const warnings: string[] = [];

  if (!outlineRaw) {
    return {
      pages: [],
      source: "rules",
      confidence: 0,
      warnings: ["empty"],
      outlineRaw: "",
      suggestedTitle: "我的演示文稿",
      strictPageBoundaries: false,
    };
  }

  const rulePages = parseOutline(outlineRaw);
  const { score, reasons } = scoreOutlineConfidence(outlineRaw, rulePages);
  const suspiciousRules = isSuspiciousRuleSplit(outlineRaw, rulePages, reasons);

  const needsLlm =
    !options?.skipLlm &&
    (options?.forceLlm ||
      suspiciousRules ||
      shouldUseLlmNormalize(
        outlineRaw,
        rulePages,
        { score, reasons },
        options?.minConfidence
      ));

  if (needsLlm) {
    if (suspiciousRules) {
      console.info(
        "[resolveOutline] suspicious rule split, using LLM first",
        rulePages.length,
        reasons
      );
    }
    const pageBlocks = splitOutlineRawIntoPageBlocks(outlineRaw);
    const useChunked =
      Boolean(pageBlocks?.length) &&
      (pageBlocks!.length >= 8 || outlineRaw.length > 12_000);

    if (options?.forceLlm) {
      console.info("[resolveOutline] force LLM full normalize", {
        rulePages: rulePages.length,
        useChunked,
        chunks: pageBlocks
          ? Math.ceil(pageBlocks.length / (Number(process.env.OUTLINE_LLM_CHUNK_PAGES) || 2))
          : 0,
      });
    }

    const llm = await normalizeOutlineWithLlm(outlineRaw, {
      useChunked,
      fallbackPages:
        rulePages.length > 0 &&
        pageBlocks?.length === rulePages.length
          ? rulePages
          : undefined,
    });
    if (llm.ok && llm.data.pages.length > 0) {
      return {
        pages: llm.data.pages,
        source: "llm",
        confidence: Math.max(score, 0.9),
        warnings: [...warnings, ...llm.data.warnings, `llm_chat_calls:${llm.chatCalls}`],
        outlineRaw,
        suggestedTitle:
          llm.data.presentationTitle ||
          inferPresentationTitle(llm.data.pages, outlineRaw),
        strictPageBoundaries: true,
      };
    }
    if (options?.forceLlm || suspiciousRules) {
      const failDetail = !llm.ok ? llm.failure.failDetail : "未知错误";
      const hint = suspiciousRules
        ? `规则分页不可靠。${failDetail}`
        : failDetail;
      warnings.push("llm_normalize_failed");
      if (!llm.ok) warnings.push(`llm_fail:${llm.failure.failReason}`);
      const explicit = countExplicitPageMarkers(outlineRaw);
      const trustRules =
        rulePages.length > 0 &&
        (explicit === 0 || explicit === rulePages.length);
      return {
        pages: trustRules ? rulePages : [],
        source: "rules",
        confidence: score,
        warnings: [...warnings, ...reasons, ...(suspiciousRules ? ["suspicious_rule_split"] : [])],
        outlineRaw,
        suggestedTitle: inferPresentationTitle(rulePages, outlineRaw),
        strictPageBoundaries: trustRules && explicit >= 2,
        llmFailed: true,
        llmError: `${hint}（GrsAI 日志「成功」只表示聊天已计费，不等于应用已采纳 JSON。）`,
      };
    }
    if (!llm.ok && needsLlm && !options?.forceLlm && !suspiciousRules) {
      warnings.push(`llm_fail:${llm.failure.failReason}`);
      warnings.push(llm.failure.failDetail);
    }
    if (needsLlm && rulePages.length === 0) {
      warnings.push("llm_normalize_failed");
    } else if (needsLlm) {
      warnings.push("llm_fallback_to_rules");
    }
  }

  return {
    pages: rulePages,
    source: "rules",
    confidence: score,
    warnings: [...warnings, ...reasons],
    outlineRaw,
    suggestedTitle: inferPresentationTitle(rulePages, outlineRaw),
    strictPageBoundaries: rulePages.length > 0 && score >= 0.85,
  };
}
