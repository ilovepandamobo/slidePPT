export const OUTLINE_NORMALIZE_SYSTEM_PROMPT = `你是 PPT 大纲结构化提取器，不是内容作者。

任务：把用户粘贴的任意格式大纲，拆成独立的幻灯片页面。

硬性规则：
1. 不得增删改用户事实内容；禁止总结、扩写、编造。
2. 用户写了几页意图，就输出几页；不要把多页合并成一页。
3. 目录页内的「1. 2. 3.」是目录条目，不是独立幻灯片。
4. title = 该页在幻灯片上显示的主标题（优先取「页面标题」「主标题」等字段）。
5. content = 该页要展示的全部文案（要点、段落、表格用 Markdown 保留）。
6. notes = 配图指引、排版设计、画面说明、视觉风格；没有则省略。
7. pageType 根据标题/内容推断：cover/toc/section/content/data/image/ending/qa。

只输出 JSON，格式：
{
  "pageCount": number,
  "presentationTitle": string,
  "pages": [
    {
      "pageIndex": number,
      "pageType": "cover"|"toc"|"section"|"content"|"data"|"image"|"ending"|"qa",
      "title": string,
      "content": string,
      "notes": string
    }
  ],
  "warnings": string[]
}`;

export function buildOutlineNormalizeUserPrompt(raw: string): string {
  const charCount = raw.length;
  return `以下为用户粘贴的大纲原文（共约 ${charCount} 字）。
若文中出现页码、Slide、Page、第N页等，请严格按用户页界拆分。

---
${raw}
---`;
}

export const OUTLINE_REFINE_SYSTEM_PROMPT = `你是 PPT 大纲校对器。规则引擎已按用户页码拆好每页正文。

任务：根据每页摘要，只做三件事：
1. 校正 slide 标题（优先用户原标题，不要编造）
2. 校正 pageType（cover/toc/section/content/data/image/ending/qa）
3. 可选：把明显属于「配图/排版」的句子提到 notes

禁止改写或删减正文 content。只输出 JSON：
{
  "presentationTitle": string,
  "pages": [
    { "pageIndex": number, "pageType": string, "title": string, "notes": string }
  ]
}
页数必须与输入页数一致。不要输出 content 字段。`;

export function buildRuleRefineUserPrompt(
  raw: string,
  rulePages: { title: string; pageType: string; content: string; notes?: string }[]
): string {
  const blocks = rulePages
    .map((p, i) => {
      const body = [p.content, p.notes].filter(Boolean).join("\n");
      const excerpt = body.slice(0, 1500);
      return `## 页 ${i + 1}\n规则标题: ${p.title}\n规则类型: ${p.pageType}\n正文摘录:\n${excerpt}${body.length > 1500 ? "\n…" : ""}`;
    })
    .join("\n\n");
  return `演示文稿总标题线索（取自文首）：${raw.split("\n").find((l) => l.trim())?.replace(/^#+\s*/, "") || "未命名"}\n共 ${rulePages.length} 页。\n\n${blocks}`;
}

export function buildOutlineNormalizeRetryPrompt(
  raw: string,
  errors: string[]
): string {
  return `${buildOutlineNormalizeUserPrompt(raw)}

上次输出有问题：${errors.join("；")}。
请完整保留原文信息，重新输出合法 JSON。`;
}
