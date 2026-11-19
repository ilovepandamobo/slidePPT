type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type GrsaiChatParams = {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  jsonMode?: boolean;
  maxTokens?: number;
  /** 单次请求等待上限；大纲等长任务请用更大值 */
  timeoutMs?: number;
};

const DEFAULT_CHAT_MODELS = [
  "gpt-6.1-terra",
  "gpt-6.1-sol",
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-6-astra",
] as const;

function parseChatModelList(env: string | undefined): string[] {
  if (!env?.trim()) return [];
  return env
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 大纲结构化只用单模型，避免一次识别扣多次费且仍无 JSON */
export function getOutlineChatModel(): string {
  return (
    process.env.GRSAI_OUTLINE_CHAT_MODEL?.trim() ||
    process.env.GRSAI_CHAT_MODEL?.trim() ||
    DEFAULT_CHAT_MODELS[0]
  );
}

export function getChatModelChain(primary?: string | null): string[] {
  const p = primary?.trim() || process.env.GRSAI_CHAT_MODEL?.trim() || DEFAULT_CHAT_MODELS[0];
  const fromEnv = parseChatModelList(process.env.GRSAI_CHAT_MODEL_FALLBACKS);
  const rest = fromEnv.length ? fromEnv : [...DEFAULT_CHAT_MODELS];
  return [...new Set([p, ...rest.filter((m) => m !== p)])];
}

function getChatConfig() {
  const apiKey = process.env.GRSAI_API_KEY || "";
  const baseUrl = (
    process.env.GRSAI_CHAT_BASE_URL ||
    process.env.GRSAI_BASE_URL ||
    "https://grsai.dakka.com.cn"
  ).replace(/\/$/, "");
  const model = getChatModelChain()[0];
  return { apiKey, baseUrl, model };
}

export function isGrsaiChatConfigured(): boolean {
  return Boolean(process.env.GRSAI_API_KEY?.trim());
}

function isFetchTimeoutError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  if (e.name === "TimeoutError" || e.name === "AbortError") return true;
  const msg = e.message.toLowerCase();
  return msg.includes("timeout") || msg.includes("aborted");
}

type ChatAttemptResult =
  | { kind: "ok"; content: string }
  | { kind: "timeout" }
  | { kind: "fail" };

async function grsaiChatCompletionOneModel(
  params: GrsaiChatParams,
  model: string
): Promise<ChatAttemptResult> {
  const { apiKey, baseUrl } = getChatConfig();
  if (!apiKey) return { kind: "fail" };

  const body: Record<string, unknown> = {
    model,
    stream: false,
    messages: params.messages,
    temperature: params.temperature ?? 0,
  };
  if (params.maxTokens) body.max_tokens = params.maxTokens;
  if (params.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const timeoutMs =
    params.timeoutMs ??
    (Number(process.env.GRSAI_CHAT_TIMEOUT_MS) || 120_000);
  console.info(
    `[grsai-chat] POST ${baseUrl}/v1/chat/completions model=${model} timeoutMs=${timeoutMs}`
  );

  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(
        `[grsai-chat ${model}] HTTP`,
        res.status,
        errText.slice(0, 200)
      );
      return { kind: "fail" };
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    return content ? { kind: "ok", content } : { kind: "fail" };
  } catch (e) {
    if (isFetchTimeoutError(e)) {
      console.warn(
        `[grsai-chat ${model}] client timeout after ${timeoutMs}ms (GrsAI may still finish and bill; no result received)`
      );
      return { kind: "timeout" };
    }
    console.warn(
      `[grsai-chat ${model}] failed:`,
      e instanceof Error ? e.message : e
    );
    return { kind: "fail" };
  }
}

/** GrsAI Chat — OpenAI 兼容 /v1/chat/completions，模型维护时自动换备选 */
export async function grsaiChatCompletion(
  params: GrsaiChatParams
): Promise<string | null> {
  if (!isGrsaiChatConfigured()) return null;

  const models = params.model
    ? [params.model]
    : getChatModelChain();

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const attempt = await grsaiChatCompletionOneModel(params, model);
    if (attempt.kind === "ok") return attempt.content;
    if (attempt.kind === "timeout") {
      return null;
    }
    if (i < models.length - 1) {
      console.warn(`[grsai-chat] ${model} unavailable, try ${models[i + 1]}`);
    }
  }
  return null;
}
