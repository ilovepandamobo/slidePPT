
import {
  grsaiChatCompletion,
  getOutlineChatModel,
  isGrsaiChatConfigured,
} from "@/lib/ai/grsai-chat";
import {
  OUTLINE_NORMALIZE_SYSTEM_PROMPT,
  buildOutlineNormalizeUserPrompt,
  buildOutlineNormalizeRetryPrompt,
  buildOutlineNormalizeChunkUserPrompt,
} from "@/lib/outline/prompts";
import { splitOutlineRawIntoPageBlocks } from "@/lib/outline";
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
  const pageCount = result.pages.length;
  const lossRatio =
    pageCount >= 20 ? 0.32 : pageCount >= 10 ? 0.42 : 0.55;
  if (
    rawNorm.length > 200 &&
    extractedNorm.length < rawNorm.length * lossRatio
  ) {
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

function canRelaxedAccept(errors: string[]): boolean {
  if (errors.length === 0) return false;
  if (errors.includes("empty_title")) return false;
  return errors.every((e) =>
    ["content_loss_suspected", "page_count_mismatch", "empty_page"].includes(e)
  );
}

function parseLlmResponse(text: string): LlmOutlineResponse | null {
  const jsonText = extractJsonObject(text);
  if (!jsonText) return null;

  try {
    const parsed = JSON.parse(jsonText) as unknown;
    const result = LlmOutlineResponseSchema.safeParse(parsed);
    if (!result.success) {
      console.warn(
        "[outline-llm] schema reject:",
        result.error.issues.slice(0, 3).map((i) => i.message).join("; ")
      );
      return null;
    }
    return result.data;
  } catch {
    return null;
  }
}

const OUTLINE_LLM_TIMEOUT_MS =
  Number(process.env.GRSAI_CHAT_OUTLINE_TIMEOUT_MS) || 300_000;
const CHUNK_PAGES =
  Number(process.env.OUTLINE_LLM_CHUNK_PAGES) || 5;
const CHUNK_CONCURRENCY = Math.max(
  1,
  Math.min(8, Number(process.env.OUTLINE_LLM_CHUNK_CONCURRENCY) || 6)
);

const CHUNK_LLM_TIMEOUT_MS =
  Number(process.env.GRSAI_CHAT_CHUNK_TIMEOUT_MS) || 150_000;

export type NormalizeLlmOptions = {
  /** 长稿按页界分块，每块仍用完整结构化 prompt（与单次识别指令相同） */
  useChunked?: boolean;
};

function outlineLlmMaxTokens(raw: string): number {
  const slideMarkers = raw.match(/(?:^|\n)\s*#{0,3}\s*Slide\s+\d+/gi)?.length ?? 0;
  const numHeaders =
    raw.match(
      /(?:^|\n)\s*#{1,3}\s*(?:(?:0?[1-9]|[1-2]\d|25)(?:[｜|：:\u3000]|\s+)|(?:备选\s*)?[A-Da-d](?:[｜|：:\u3000]|\s+))/gm
    )?.length ?? 0;
  const cnMarkers = raw.match(/第\s*\d+\s*页/g)?.length ?? 0;
  const pipeRows = (raw.match(/(?:^|\n)\s*\|[^|\n]+\|/gm) || []).length;
  const estPages = Math.max(
    slideMarkers,
    numHeaders,
    cnMarkers,
    Math.ceil(pipeRows / 2)
  );
  if (estPages >= 25 || raw.length > 40_000) return 28_000;
  if (estPages >= 15 || raw.length > 25_000) return 20_000;
  if (estPages >= 8 || raw.length > 15_000) return 12_000;
  return 8000;
}

async function callNormalizeLlm(
  userContent: string,
  rawForTokens: string,
  timeoutMs = OUTLINE_LLM_TIMEOUT_MS
): Promise<string | null> {
  const model = getOutlineChatModel();
  return grsaiChatCompletion({
    messages: [
      { role: "system", content: OUTLINE_NORMALIZE_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    model,
    jsonMode: true,
    maxTokens: outlineLlmMaxTokens(rawForTokens),
    temperature: 0,
    timeoutMs,
  });
}

export type LlmNormalizeResult = {
  pages: OutlinePage[];
  presentationTitle?: string;
  warnings: string[];
};

export type LlmNormalizeFailure = {
  failReason:
    | "not_configured"
    | "too_long"
    | "chat_empty"
    | "parse_failed"
    | "validation_failed";
  failDetail: string;
  chatCalls: number;
};

export type LlmNormalizeOutcome =
  | { ok: true; data: LlmNormalizeResult; chatCalls: number }
  | { ok: false; failure: LlmNormalizeFailure };

function finishOk(
  parsed: LlmOutlineResponse,
  extraWarnings: string[] = [],
  chatCalls: number
): LlmNormalizeOutcome {
  return {
    ok: true,
    chatCalls,
    data: {
      pages: llmPagesToOutlinePages(parsed),
      presentationTitle: parsed.presentationTitle?.trim(),
      warnings: [...(parsed.warnings ?? []), ...extraWarnings],
    },
  };
}

async function normalizeOutlineSinglePass(
  trimmed: string,
  buildUser: (text: string) => string = buildOutlineNormalizeUserPrompt,
  timeoutMs = OUTLINE_LLM_TIMEOUT_MS
): Promise<LlmNormalizeOutcome> {
  let chatCalls = 0;

  let content = await callNormalizeLlm(buildUser(trimmed), trimmed, timeoutMs);
  chatCalls++;
  if (!content) {
    return {
      ok: false,
      failure: {
        failReason: "chat_empty",
        failDetail:
          "GrsAI 聊天无正文（可能超时或模型维护）。控制台仍可能显示成功扣费。",
        chatCalls,
      },
    };
  }

  let parsed = parseLlmResponse(content);
  if (!parsed) {
    return {
      ok: false,
      failure: {
        failReason: "parse_failed",
        failDetail:
          "模型已返回内容，但不是合法 JSON（常见：页数太多输出被截断）。",
        chatCalls,
      },
    };
  }

  let errors = validateLlmOutline(trimmed, parsed);
  if (
    errors.length === 1 &&
    errors[0] === "page_count_mismatch" &&
    parsed.pages.length > 0
  ) {
    parsed = { ...parsed, pageCount: parsed.pages.length };
    errors = validateLlmOutline(trimmed, parsed);
  }

  if (errors.length > 0 && canRelaxedAccept(errors)) {
    console.warn("[outline-llm] relaxed accept:", errors.join(","));
    return finishOk(parsed, [`relaxed:${errors.join(",")}`], chatCalls);
  }

  if (errors.length > 0) {
    console.warn("[outline-llm] validate errors, retry once:", errors.join(","));
    content = await callNormalizeLlm(
      buildOutlineNormalizeRetryPrompt(trimmed, errors),
      trimmed,
      timeoutMs
    );
    chatCalls++;
    if (!content) {
      return {
        ok: false,
        failure: {
          failReason: "chat_empty",
          failDetail: "纠错重试无响应",
          chatCalls,
        },
      };
    }
    parsed = parseLlmResponse(content);
    if (!parsed) {
      return {
        ok: false,
        failure: {
          failReason: "parse_failed",
          failDetail: "纠错后仍无法解析 JSON",
          chatCalls,
        },
      };
    }
    errors = validateLlmOutline(trimmed, parsed);
    if (errors.length > 0 && canRelaxedAccept(errors)) {
      return finishOk(parsed, [`relaxed:${errors.join(",")}`], chatCalls);
    }
    if (errors.length > 0) {
      return {
        ok: false,
        failure: {
          failReason: "validation_failed",
          failDetail: `校验未通过：${errors.join("、")}（已请求 ${chatCalls} 次聊天）`,
          chatCalls,
        },
      };
    }
  }

  return finishOk(parsed, [], chatCalls);
}

async function normalizeOutlineChunked(
  fullRaw: string,
  pageBlocks: string[]
): Promise<LlmNormalizeOutcome> {
  const totalPages = pageBlocks.length;
  const chunkSpecs: { text: string; start: number; end: number }[] = [];
  for (let i = 0; i < pageBlocks.length; i += CHUNK_PAGES) {
    const slice = pageBlocks.slice(i, i + CHUNK_PAGES);
    chunkSpecs.push({
      text: slice.join("\n\n"),
      start: i + 1,
      end: i + slice.length,
    });
  }

  console.info(
    "[outline-llm] chunked normalize",
    totalPages,
    "pages",
    chunkSpecs.length,
    "chunks"
  );

  const mergedPages: OutlinePage[] = [];
  let chatCalls = 0;
  let presentationTitle = "";
  const warnings: string[] = ["llm_chunked", `chunks:${chunkSpecs.length}`];

  const waveSize = Math.min(CHUNK_CONCURRENCY, chunkSpecs.length);
  for (let c = 0; c < chunkSpecs.length; c += waveSize) {
    const batch = chunkSpecs.slice(c, c + waveSize);
    const batchResults = await Promise.all(
      batch.map(async (spec) => {
        const user = buildOutlineNormalizeChunkUserPrompt(spec.text, {
          globalStart: spec.start,
          globalEnd: spec.end,
          totalPages,
        });
        return normalizeOutlineSinglePass(
          spec.text,
          () => user,
          CHUNK_LLM_TIMEOUT_MS
        );
      })
    );

    for (let j = 0; j < batchResults.length; j++) {
      const spec = batch[j]!;
      const out = batchResults[j]!;
      chatCalls += out.ok ? out.chatCalls : out.failure.chatCalls;
      if (!out.ok) {
        return {
          ok: false,
          failure: {
            ...out.failure,
            failDetail: `第 ${spec.start}–${spec.end} 页批次失败：${out.failure.failDetail}`,
            chatCalls,
          },
        };
      }
      if (!presentationTitle && out.data.presentationTitle) {
        presentationTitle = out.data.presentationTitle;
      }
      mergedPages.push(...out.data.pages);
      warnings.push(...out.data.warnings);
    }
  }

  if (mergedPages.length !== totalPages) {
    return {
      ok: false,
      failure: {
        failReason: "validation_failed",
        failDetail: `分块合并后 ${mergedPages.length} 页，预期 ${totalPages} 页`,
        chatCalls,
      },
    };
  }

  const merged: LlmOutlineResponse = {
    pageCount: totalPages,
    presentationTitle: presentationTitle || undefined,
    pages: mergedPages.map((p, i) => ({
      pageType: p.pageType,
      title: p.title,
      content: p.content,
      notes: p.notes,
      pageIndex: i + 1,
    })),
    warnings,
  };

  const errors = validateLlmOutline(fullRaw, merged);
  if (errors.length > 0 && !canRelaxedAccept(errors)) {
    return {
      ok: false,
      failure: {
        failReason: "validation_failed",
        failDetail: `全稿校验：${errors.join("、")}`,
        chatCalls,
      },
    };
  }
  if (errors.length > 0) {
    warnings.push(`relaxed:${errors.join(",")}`);
  }

  return finishOk(merged, warnings, chatCalls);
}

function shouldUseChunkedNormalize(
  trimmed: string,
  pageBlocks: string[] | null
): boolean {
  if (!pageBlocks || pageBlocks.length < 6) return false;
  return pageBlocks.length >= 8 || trimmed.length > 12_000;
}

export async function normalizeOutlineWithLlm(
  raw: string,
  options?: NormalizeLlmOptions
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

  const trimmed = normalizeOutlineInput(raw);
  if (!trimmed || trimmed.length > MAX_OUTLINE_CHARS) {
    return {
      ok: false,
      failure: {
        failReason: "too_long",
        failDetail: `大纲超过 ${MAX_OUTLINE_CHARS} 字`,
        chatCalls: 0,
      },
    };
  }

  const pageBlocks = splitOutlineRawIntoPageBlocks(trimmed);
  if (options?.useChunked && shouldUseChunkedNormalize(trimmed, pageBlocks)) {
    return normalizeOutlineChunked(trimmed, pageBlocks!);
  }

  return normalizeOutlineSinglePass(trimmed);
}

/** @deprecated 供旧调用；优先用 normalizeOutlineWithLlm 的 outcome */
export async function normalizeOutlineWithLlmLegacy(
  raw: string
): Promise<LlmNormalizeResult | null> {
  const out = await normalizeOutlineWithLlm(raw);
  return out.ok ? out.data : null;
}