import {
  parseOutline,
  normalizeOutlineInput,
  inferPresentationTitle,
} from "@/lib/outline";
import {
  scoreOutlineConfidence,
  shouldUseLlmNormalize,
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

  const needsLlm =
    !options?.skipLlm &&
    (options?.forceLlm ||
      shouldUseLlmNormalize(
        outlineRaw,
        rulePages,
        { score, reasons },
        options?.minConfidence
      ));

  if (needsLlm) {
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
