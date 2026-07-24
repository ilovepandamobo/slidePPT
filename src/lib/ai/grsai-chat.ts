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

function getChatConfig() {
  const apiKey = process.env.GRSAI_API_KEY || "";
  const baseUrl = (
    process.env.GRSAI_CHAT_BASE_URL ||
    process.env.GRSAI_BASE_URL ||
    "https://grsai.dakka.com.cn"
  ).replace(/\/$/, "");
  const model = process.env.GRSAI_CHAT_MODEL || "gemini-3.5-flash";
  return { apiKey, baseUrl, model };
}

export function isGrsaiChatConfigured(): boolean {
  return Boolean(process.env.GRSAI_API_KEY?.trim());
}

/** GrsAI Chat — OpenAI 兼容 /v1/chat/completions */
export async function grsaiChatCompletion(
  params: GrsaiChatParams
): Promise<string | null> {
  const { apiKey, baseUrl, model: defaultModel } = getChatConfig();
  if (!apiKey) return null;

  const body: Record<string, unknown> = {
    model: params.model || defaultModel,
    stream: false,
    messages: params.messages,
    temperature: params.temperature ?? 0,
  };
  if (params.maxTokens) body.max_tokens = params.maxTokens;
  if (params.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    return content || null;
  } catch {
    return null;
  }
}
