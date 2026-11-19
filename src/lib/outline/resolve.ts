import {
  parseOutline,
  normalizeOutlineInput,
  inferPresentationTitle,
} from "@/lib/outline";
import {
  scoreOutlineConfidence,
  shouldUseLlmNormalize,
  isSuspiciousRuleSplit,
} from "@/lib/outline/confidence";
import { normalizeOutlineWithLlm } from "@/lib/outline/llm-normalize";
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
    const llm = await normalizeOutlineWithLlm(outlineRaw);
    if (llm && llm.pages.length > 0) {
      return {
        pages: llm.pages,
        source: "llm",
        confidence: Math.max(score, 0.9),
        warnings: [...warnings, ...llm.warnings],
        outlineRaw,
        suggestedTitle:
          llm.presentationTitle ||
          inferPresentationTitle(llm.pages, outlineRaw),
        strictPageBoundaries: true,
      };
    }
    if (options?.forceLlm || suspiciousRules) {
      const hint = suspiciousRules
        ? "规则分页不可靠（常见误判：表格/Markdown # 拆页）。AI 未返回可用结果，请缩长大纲、改用「第1页：」或 Slide 01 标记后重试。"
        : rulePages.length > 0
          ? "AI 未返回可用 JSON（长稿可能超出模型输出上限）。"
          : "AI 未识别出页面，请检查大纲格式。";
      warnings.push("llm_normalize_failed");
      return {
        pages: suspiciousRules ? [] : rulePages,
        source: "rules",
        confidence: score,
        warnings: [...warnings, ...reasons, ...(suspiciousRules ? ["suspicious_rule_split"] : [])],
        outlineRaw,
        suggestedTitle: inferPresentationTitle(rulePages, outlineRaw),
        strictPageBoundaries: false,
        llmFailed: true,
        llmError: hint,
      };
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
