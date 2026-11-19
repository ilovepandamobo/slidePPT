
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
const CHUNK_MAX_PAGES =
  Number(process.env.OUTLINE_LLM_CHUNK_PAGES) || 4;
const CHUNK_MAX_CHARS =
  Number(process.env.OUTLINE_LLM_CHUNK_MAX_CHARS) || 3_800;
const CHUNK_CONCURRENCY = Math.max(
  1,
  Math.min(8, Number(process.env.OUTLINE_LLM_CHUNK_CONCURRENCY) || 4)
);

const CHUNK_LLM_TIMEOUT_MS =
  Number(process.env.GRSAI_CHAT_CHUNK_TIMEOUT_MS) || 150_000;
const CHUNK_RETRY_EXTRA_MS = 60_000;

export type NormalizeLlmOptions = {
  /** 长稿按页界分块，每块仍用完整结构化 prompt（与单次识别指令相同） */
  useChunked?: boolean;
  /** 某批次 GrsAI 无响应时，用规则页填补该段 */
  fallbackPages?: OutlinePage[];
};

type ChunkSpec = { text: string; start: number; end: number };

function buildChunkSpecs(pageBlocks: string[]): ChunkSpec[] {
  const specs: ChunkSpec[] = [];
  let batch: string[] = [];
  let chars = 0;
  let start = 1;

  const flush = () => {
    if (batch.length === 0) return;
    specs.push({
      text: batch.join("\n\n"),
      start,
      end: start + batch.length - 1,
    });
    start += batch.length;
    batch = [];
    chars = 0;
  };

  for (const block of pageBlocks) {
    const blockLen = block.length;
    const wouldExceed =
      batch.length > 0 &&
      (batch.length >= CHUNK_MAX_PAGES ||
        chars + blockLen + 2 > CHUNK_MAX_CHARS);
    if (wouldExceed) flush();
    batch.push(block);
    chars += blockLen + 2;
  }
  flush();
  return specs;
}

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

async function tryChunkNormalize(
  spec: ChunkSpec,
  totalPages: number,
  maxAttempts = 3
): Promise<
  | { ok: true; pages: OutlinePage[]; calls: number; title?: string; warnings: string[] }
  | { ok: false; calls: number; failure: LlmNormalizeFailure }
> {
  let chatCalls = 0;
  let lastFailure: LlmNormalizeFailure = {
    failReason: "chat_empty",
    failDetail: "无响应",
    chatCalls: 0,
  };

  for (let tryNum = 0; tryNum < maxAttempts; tryNum++) {
    const timeout = CHUNK_LLM_TIMEOUT_MS + tryNum * CHUNK_RETRY_EXTRA_MS;
    const user = buildOutlineNormalizeChunkUserPrompt(spec.text, {
      globalStart: spec.start,
      globalEnd: spec.end,
      totalPages,
    });
    const out = await normalizeOutlineSinglePass(
      spec.text,
      () => user,
      timeout
    );
    chatCalls += out.ok ? out.chatCalls : out.failure.chatCalls;
    if (out.ok) {
      return {
        ok: true,
        pages: out.data.pages,
        calls: chatCalls,
        title: out.data.presentationTitle,
        warnings: out.data.warnings,
      };
    }
    lastFailure = { ...out.failure, chatCalls };
    const retriable =
      out.failure.failReason === "chat_empty" ||
      out.failure.failReason === "parse_failed";
    if (!retriable) break;
    console.warn(
      `[outline-llm] chunk ${spec.start}-${spec.end} retry ${tryNum + 1}`
    );
  }

  return { ok: false, calls: chatCalls, failure: lastFailure };
}

async function runOneChunkWithRetry(
  spec: ChunkSpec,
  totalPages: number,
  pageBlocks: string[],
  fallbackPages?: OutlinePage[]
): Promise<
  | { ok: true; pages: OutlinePage[]; calls: number; title?: string; extraWarnings: string[] }
  | { ok: false; failure: LlmNormalizeFailure }
> {
  const batch = await tryChunkNormalize(spec, totalPages);
  if (batch.ok) {
    const expected = spec.end - spec.start + 1;
    if (batch.pages.length === expected) {
      return {
        ok: true,
        pages: batch.pages,
        calls: batch.calls,
        title: batch.title,
        extraWarnings: batch.warnings,
      };
    }
  }

  let chatCalls = batch.calls;
  const extraWarnings: string[] = [];

  if (spec.end > spec.start) {
    const pages: OutlinePage[] = [];
    for (let i = spec.start; i <= spec.end; i++) {
      const singleSpec: ChunkSpec = {
        text: pageBlocks[i - 1]!,
        start: i,
        end: i,
      };
      const one = await tryChunkNormalize(singleSpec, totalPages, 2);
      chatCalls += one.calls;
      if (one.ok && one.pages.length >= 1) {
        pages.push(one.pages[0]!);
        if (one.title && i === spec.start) {
          extraWarnings.push(...one.warnings);
        }
        continue;
      }
      const fb = fallbackPages?.[i - 1];
      if (fb) {
        pages.push(fb);
        extraWarnings.push(`chunk_rules_fallback:${i}`);
        continue;
      }
      const fail = !one.ok
        ? one.failure
        : !batch.ok
          ? batch.failure
          : {
              failReason: "validation_failed" as const,
              failDetail: "批次页数不匹配",
              chatCalls,
            };
      return {
        ok: false,
        failure: { ...fail, failDetail: `第 ${i} 页 AI 无响应`, chatCalls },
      };
    }
    return { ok: true, pages, calls: chatCalls, extraWarnings };
  }

  if (fallbackPages?.[spec.start - 1]) {
    return {
      ok: true,
      pages: [fallbackPages[spec.start - 1]!],
      calls: chatCalls,
      extraWarnings: [`chunk_rules_fallback:${spec.start}-${spec.end}`],
    };
  }

  if (!batch.ok) {
    return { ok: false, failure: { ...batch.failure, chatCalls } };
  }
  return {
    ok: false,
    failure: {
      failReason: "validation_failed",
      failDetail: "单页批次未产出结果",
      chatCalls,
    },
  };
}

async function normalizeOutlineChunked(
  fullRaw: string,
  pageBlocks: string[],
  fallbackPages?: OutlinePage[]
): Promise<LlmNormalizeOutcome> {
  const totalPages = pageBlocks.length;
  const chunkSpecs = buildChunkSpecs(pageBlocks);

  console.info(
    "[outline-llm] chunked normalize",
    totalPages,
    "pages",
    chunkSpecs.length,
    "chunks",
    chunkSpecs.map((s) => `${s.start}-${s.end}`).join(",")
  );

  const mergedPages: OutlinePage[] = [];
  let chatCalls = 0;
  let presentationTitle = "";
  const warnings: string[] = ["llm_chunked", `chunks:${chunkSpecs.length}`];

  const waveSize = Math.min(CHUNK_CONCURRENCY, chunkSpecs.length);
  for (let c = 0; c < chunkSpecs.length; c += waveSize) {
    const batch = chunkSpecs.slice(c, c + waveSize);
    const batchResults = await Promise.all(
      batch.map((spec) =>
        runOneChunkWithRetry(spec, totalPages, pageBlocks, fallbackPages)
      )
    );

    for (let j = 0; j < batchResults.length; j++) {
      const spec = batch[j]!;
      const out = batchResults[j]!;
      chatCalls += out.ok ? out.calls : out.failure.chatCalls;
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
      if (!presentationTitle && out.title) {
        presentationTitle = out.title;
      }
      mergedPages.push(...out.pages);
      warnings.push(...out.extraWarnings);
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
    return normalizeOutlineChunked(
      trimmed,
      pageBlocks!,
      options.fallbackPages
    );
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