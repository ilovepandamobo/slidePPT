import { hasStructuredSlideMarkers } from "@/lib/slide-content";
import {
  hasExplicitPageMarkers,
  countExplicitPageMarkers,
  normalizeOutlineInput,
} from "@/lib/outline";
import type { OutlinePage } from "@/types";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** 长文但无页码时，是否像多页大纲 */
export function looksMultiSlide(raw: string): boolean {
  const text = normalizeOutlineInput(raw);
  if (countExplicitPageMarkers(text) >= 2) return true;
  if (/(?:^|\n)\s*#{1,3}\s+/m.test(text)) {
    const headers = text.match(/(?:^|\n)\s*#{1,3}\s+.+/g) || [];
    if (headers.length >= 2) return true;
  }
  if (/(?:^|\n)\s*(?:Page|Slide)\s*\d+/im.test(text)) return true;
  if (/(?:^|\n)\s*\*\*页面标题\*\*/m.test(text)) {
    const titles = text.match(/\*\*页面标题\*\*/g) || [];
    if (titles.length >= 2) return true;
  }
  return false;
}

export type ConfidenceResult = {
  score: number;
  reasons: string[];
};

export function scoreOutlineConfidence(
  raw: string,
  pages: OutlinePage[]
): ConfidenceResult {
  const reasons: string[] = [];
  if (pages.length === 0) {
    return { score: 0, reasons: ["empty"] };
  }

  let score = 0.2;

  if (hasExplicitPageMarkers(raw)) {
    const expected = countExplicitPageMarkers(raw);
    if (expected > 0 && expected === pages.length) {
      score += 0.4;
    } else if (expected > 0) {
      reasons.push(`marker_count_mismatch:${expected}vs${pages.length}`);
      score += 0.1;
    } else {
      score += 0.25;
    }
  } else if (pages.length >= 2 && !looksMultiSlide(raw)) {
    score += 0.25;
  }

  const complete = pages.filter(
    (p) => p.title.trim() && p.content.trim()
  ).length;
  score += 0.25 * (complete / pages.length);

  if (pages.length === 1 && raw.length > 800 && looksMultiSlide(raw)) {
    reasons.push("likely_under_split");
    score -= 0.35;
  }

  if (
    pages.length > 3 &&
    pages.some((p) => p.content.trim().length < 20 && !p.notes?.trim())
  ) {
    reasons.push("suspicious_short_page");
    score -= 0.1;
  }

  if (hasStructuredSlideMarkers(raw) && complete >= pages.length * 0.8) {
    score += 0.1;
  }

  return { score: clamp(score, 0, 1), reasons };
}

export function shouldUseLlmNormalize(
  raw: string,
  pages: OutlinePage[],
  confidence: ConfidenceResult,
  minConfidence = 0.85
): boolean {
  if (pages.length === 0) return true;
  if (confidence.score < minConfidence) return true;

  if (hasExplicitPageMarkers(raw)) {
    const expected = countExplicitPageMarkers(raw);
    if (expected > 0 && expected !== pages.length) return true;
  }

  if (pages.length === 1 && raw.length > 800 && looksMultiSlide(raw)) {
    return true;
  }

  return false;
}
