import { grsaiChatCompletion, isGrsaiChatConfigured } from "@/lib/ai/grsai-chat";
import {
  OUTLINE_NORMALIZE_SYSTEM_PROMPT,
  buildOutlineNormalizeUserPrompt,
  buildOutlineNormalizeRetryPrompt,
} from "@/lib/outline/prompts";
import {
  LlmOutlineResponseSchema,
  llmPagesToOutlinePages,
  type LlmOutlineResponse,
} from "@/lib/outline/schema";
import { normalizeOutlineInput } from "@/lib/outline";
import type { OutlinePage } from "@/types";

const MAX_OUTLINE_CHARS = 50_000;

function normalizeChars(text: string): string {
  return text.replace(/\s+/g, "");
}

function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return null;
}

export function validateLlmOutline(
  raw: string,
  result: LlmOutlineResponse
): string[] {
  const errors: string[] = [];

  if (result.pages.length !== result.pageCount) {
    errors.push("page_count_mismatch");
  }

  const extracted = result.pages
    .map((p) => `${p.title}${p.content}${p.notes ?? ""}`)
    .join("");
  const rawNorm = normalizeChars(normalizeOutlineInput(raw));
  const extractedNorm = normalizeChars(extracted);
  if (rawNorm.length > 200 && extractedNorm.length < rawNorm.length * 0.55) {
    errors.push("content_loss_suspected");
  }

  if (
    result.pages.some((p) => !p.content.trim() && !p.notes?.trim())
  ) {
    errors.push("empty_page");
  }

  if (result.pages.some((p) => !p.title.trim())) {
    errors.push("empty_title");
  }

  return errors;
}

function parseLlmResponse(text: string): LlmOutlineResponse | null {
  const jsonText = extractJsonObject(text);
  if (!jsonText) return null;

  try {
    const parsed = JSON.parse(jsonText) as unknown;
    const result = LlmOutlineResponseSchema.safeParse(parsed);
    if (!result.success) return null;
    return result.data;
  } catch {
    return null;
  }
}

async function callNormalizeLlm(userContent: string): Promise<string | null> {
  return grsaiChatCompletion({
    messages: [
      { role: "system", content: OUTLINE_NORMALIZE_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    jsonMode: true,
    maxTokens: 8000,
    temperature: 0,
  });
}

export type LlmNormalizeResult = {
  pages: OutlinePage[];
  presentationTitle?: string;
  warnings: string[];
};

export async function normalizeOutlineWithLlm(
  raw: string
): Promise<LlmNormalizeResult | null> {
  if (!isGrsaiChatConfigured()) return null;

  const trimmed = normalizeOutlineInput(raw);
  if (!trimmed || trimmed.length > MAX_OUTLINE_CHARS) return null;

  let content = await callNormalizeLlm(buildOutlineNormalizeUserPrompt(trimmed));
  if (!content) return null;

  let parsed = parseLlmResponse(content);
  if (!parsed) return null;

  let errors = validateLlmOutline(trimmed, parsed);
  if (errors.length > 0) {
    content = await callNormalizeLlm(
      buildOutlineNormalizeRetryPrompt(trimmed, errors)
    );
    if (!content) return null;
    parsed = parseLlmResponse(content);
    if (!parsed) return null;
    errors = validateLlmOutline(trimmed, parsed);
    if (errors.length > 0) return null;
  }

  return {
    pages: llmPagesToOutlinePages(parsed),
    presentationTitle: parsed.presentationTitle?.trim(),
    warnings: parsed.warnings ?? [],
  };
}
