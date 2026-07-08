/**
 * 大纲/编辑区里的「标题：」「内容：」「画面：」是给人和策划 AI 看的结构标记，
 * 不应出现在成图幻灯片上。生成前拆成 headline / body / visualDirection。
 */

export type PreparedSlideText = {
  headline: string;
  body: string;
  /** 画面/配图说明 — 仅作构图参考，不当作幻灯片上的可见文案 */
  visualDirection?: string;
};

const SECTION_HEADER =
  /^(?:标题|内容|画面|配图(?:指引)?|核心内容)\s*[:：]?\s*(.*)$/i;

const LABEL_ONLY = /^(?:标题|内容|画面|配图(?:指引)?|核心内容)\s*[:：]?\s*$/i;

function stripInlineLabel(line: string): string {
  const m = line.match(SECTION_HEADER);
  if (m && m[1]?.trim()) return m[1].trim();
  if (LABEL_ONLY.test(line.trim())) return "";
  return line;
}

/** 是否含有常见的中文页内结构标记 */
export function hasStructuredSlideMarkers(text: string): boolean {
  return /(?:^|\n)\s*(?:标题|内容|画面|配图(?:指引)?)\s*[:：]/m.test(text);
}

/**
 * 从单页正文中解析 标题/内容/画面，供存库或展示用（不修改 slide.title 若已有独立标题）
 */
export function parseStructuredPageBody(raw: string): {
  titleFromBody?: string;
  content: string;
  notes?: string;
} {
  if (!hasStructuredSlideMarkers(raw)) {
    return { content: raw.trim() };
  }

  let titleFromBody = "";
  const bodyLines: string[] = [];
  const visualLines: string[] = [];
  let section: "none" | "title" | "body" | "visual" = "none";

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (LABEL_ONLY.test(trimmed)) continue;

    const titleM = trimmed.match(/^标题\s*[:：]\s*(.*)$/i);
    if (titleM) {
      section = "title";
      if (titleM[1]?.trim()) titleFromBody = titleM[1].trim();
      continue;
    }
    const bodyM = trimmed.match(/^内容\s*[:：]\s*(.*)$/i);
    if (bodyM) {
      section = "body";
      if (bodyM[1]?.trim()) bodyLines.push(bodyM[1].trim());
      continue;
    }
    const visualM = trimmed.match(/^(?:画面|配图(?:指引)?)\s*[:：]\s*(.*)$/i);
    if (visualM) {
      section = "visual";
      if (visualM[1]?.trim()) visualLines.push(visualM[1].trim());
      continue;
    }
    if (/^核心内容\s*[:：]?\s*$/i.test(trimmed)) {
      section = "body";
      continue;
    }

    if (section === "title") {
      if (!titleFromBody) titleFromBody = trimmed;
      else bodyLines.push(trimmed);
    } else if (section === "visual") {
      visualLines.push(trimmed);
    } else {
      bodyLines.push(stripInlineLabel(trimmed));
    }
  }

  const content = bodyLines.join("\n").trim();
  const notes = visualLines.length
    ? `画面：${visualLines.join("\n")}`
    : undefined;

  return {
    titleFromBody: titleFromBody || undefined,
    content: content || raw.replace(SECTION_HEADER, "$1").trim(),
    notes,
  };
}

/** 生成图片前：去掉结构标签，画面说明仅进 visualDirection */
export function prepareSlideContentForImage(
  title: string,
  content: string,
  notes?: string | null
): PreparedSlideText {
  const parsed = parseStructuredPageBody(content);
  const headline = (parsed.titleFromBody || title).trim();
  let body = parsed.content.trim();

  if (!body && content.trim()) {
    body = content
      .split("\n")
      .map(stripInlineLabel)
      .filter((l) => l.trim())
      .join("\n")
      .trim();
  }

  const visualFromBody = parsed.notes?.replace(/^画面\s*[:：]\s*/i, "").trim();
  const visualDirection = [visualFromBody, notes?.trim()]
    .filter(Boolean)
    .join("\n")
    .trim() || undefined;

  return { headline, body, visualDirection };
}
