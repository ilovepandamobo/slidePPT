import type { OutlinePage } from "@/types";

export async function assistOutline(topic: string, audience?: string, duration?: number): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const pageCount = duration ? Math.max(3, Math.min(20, Math.round(duration / 2))) : 8;

  if (apiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "你是专业 PPT 策划师。根据用户主题生成中文大纲，格式为每页用 # 或 ## 标题，要点用 - 列表。包含封面、目录、正文、结语。只输出大纲文本。",
            },
            {
              role: "user",
              content: `主题：${topic}\n受众：${audience || "通用"}\n目标页数约：${pageCount} 页`,
            },
          ],
          temperature: 0.7,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const content = data.choices?.[0]?.message?.content;
        if (content) return content.trim();
      }
    } catch {
      /* fallback */
    }
  }

  return `# 封面：${topic}
# 目录
## 背景与现状
- 行业趋势
- 核心挑战
## 我们的方案
- 产品介绍
- 核心优势
## 关键数据
- 增长指标
- 用户反馈
## 下一步计划
- 短期目标
- 长期愿景
# 结语：谢谢`;
}

export async function refineDeckPrompt(
  instruction: string,
  slides: OutlinePage[]
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return `已记录指令：${instruction}。将在重生成时应用更${instruction.includes("简约") ? "简约" : "活泼"}的风格。`;
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "根据用户对整套 PPT 的修改指令，输出一段英文 style prompt 追加描述（50词内）。",
          },
          {
            role: "user",
            content: `指令：${instruction}\n当前页数：${slides.length}`,
          },
        ],
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      return data.choices?.[0]?.message?.content?.trim() || instruction;
    }
  } catch {
    /* fallback */
  }
  return instruction;
}
