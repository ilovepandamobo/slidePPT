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

export function buildOutlineNormalizeRetryPrompt(
  raw: string,
  errors: string[]
): string {
  return `${buildOutlineNormalizeUserPrompt(raw)}

上次输出有问题：${errors.join("；")}。
请完整保留原文信息，重新输出合法 JSON。`;
}
