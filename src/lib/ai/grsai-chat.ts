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
};

const DEFAULT_CHAT_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash-001",
  "deepseek-chat",
  "qwen-plus",
] as const;

function parseChatModelList(env: string | undefined): string[] {
  if (!env?.trim()) return [];
  return env
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getChatModelChain(primary?: string | null): string[] {
  const p = primary?.trim() || process.env.GRSAI_CHAT_MODEL?.trim() || "gemini-2.5-flash";
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

async function grsaiChatCompletionOneModel(
  params: GrsaiChatParams,
  model: string
): Promise<string | null> {
  const { apiKey, baseUrl } = getChatConfig();
  if (!apiKey) return null;

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

  const timeoutMs = Number(process.env.GRSAI_CHAT_TIMEOUT_MS) || 45_000;

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
      return null;
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    return content || null;
  } catch (e) {
    console.warn(
      `[grsai-chat ${model}] failed:`,
      e instanceof Error ? e.message : e
    );
    return null;
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
    const content = await grsaiChatCompletionOneModel(params, model);
    if (content) return content;
    if (i < models.length - 1) {
      console.warn(`[grsai-chat] ${model} unavailable, try ${models[i + 1]}`);
    }
  }
  return null;
}
