/**
 * 大纲/编辑区里的结构标记是给人和策划 AI 看的，
 * 不应原样出现在成图幻灯片上。生成前拆成 headline / body / visualDirection。
 */

export type PreparedSlideText = {
  headline: string;
  body: string;
  /** 画面/配图说明 — 仅作构图参考，不当作幻灯片上的可见文案 */
  visualDirection?: string;
};

const SECTION_HEADER =
  /^(?:标题|内容|画面|配图(?:指引)?|核心内容|页面标题|页面文案|内容模块|关键指标呈现|底部结论)\s*[:：]?\s*(.*)$/i;

const LABEL_ONLY =
  /^(?:标题|内容|画面|配图(?:指引)?|核心内容|页面标题|页面文案|内容模块|排版设计|关键指标呈现|底部结论)\s*[:：]?\s*$/i;

const MD_BOLD_LABEL =
  /^\*\*(页面标题|页面文案|内容模块|排版设计|关键指标呈现|底部结论)\*\*\s*$/;

function stripMarkdownBold(text: string): string {
  return text.replace(/\*\*/g, "").trim();
}

function stripInlineLabel(line: string): string {
  const cleaned = stripMarkdownBold(line);
  const m = cleaned.match(SECTION_HEADER);
  if (m && m[1]?.trim()) return m[1].trim();
  if (LABEL_ONLY.test(cleaned)) return "";
  return cleaned;
}

/** 是否含有常见的中文页内结构标记 */
export function hasStructuredSlideMarkers(text: string): boolean {
  return (
    /(?:^|\n)\s*(?:标题|内容|画面|配图(?:指引)?|页面标题|页面文案|内容模块|排版设计)\s*[:：]/m.test(
      text
    ) ||
    /(?:^|\n)\s*\*\*(?:页面标题|页面文案|内容模块|排版设计)\*\*/m.test(text) ||
    /(?:^|\n)\s*(?:配图指引|排版设计|核心内容)\s*$/m.test(text)
  );
}

type BodySection = "none" | "title" | "body" | "visual";

function sectionFromLabel(label: string): BodySection {
  if (/页面标题|^标题$/i.test(label)) return "title";
  if (/排版设计|^画面$|^配图/i.test(label)) return "visual";
  return "body";
}

/**
 * 从单页正文中解析结构块，供存库或展示用（不修改 slide.title 若已有独立标题）
 */
export function parseStructuredPageBody(raw: string): {
  titleFromBody?: string;
  content: string;
  notes?: string;
} {
  if (!hasStructuredSlideMarkers(raw)) {
    return { content: stripMarkdownBold(raw.trim()) };
  }

  let titleFromBody = "";
  const bodyLines: string[] = [];
  const visualLines: string[] = [];
  let section: BodySection = "none";
  let visualLabel = "配图指引";

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^---+$/.test(trimmed)) continue;

    const mdLabel = trimmed.match(MD_BOLD_LABEL);
    if (mdLabel) {
      section = sectionFromLabel(mdLabel[1]);
      if (section === "visual") visualLabel = mdLabel[1];
      continue;
    }

    const cleaned = stripMarkdownBold(trimmed);
    if (LABEL_ONLY.test(cleaned)) {
      const label = cleaned.replace(/[:：]\s*$/, "");
      section = sectionFromLabel(label);
      if (section === "visual") visualLabel = label;
      continue;
    }

    const inlineSection = cleaned.match(
      /^(页面标题|页面文案|内容模块|排版设计|关键指标呈现|底部结论|标题|内容|画面|配图(?:指引)?|核心内容)\s*[:：]\s*(.*)$/i
    );
    if (inlineSection) {
      section = sectionFromLabel(inlineSection[1]);
      if (section === "visual") visualLabel = inlineSection[1];
      const rest = inlineSection[2]?.trim();
      if (rest) {
        if (section === "title") titleFromBody = rest;
        else if (section === "visual") visualLines.push(rest);
        else bodyLines.push(rest);
      }
      continue;
    }

    if (/^核心内容\s*[:：]?\s*$/i.test(cleaned)) {
      section = "body";
      continue;
    }

    if (section === "title") {
      if (!titleFromBody) titleFromBody = cleaned;
      else bodyLines.push(cleaned);
    } else if (section === "visual") {
      visualLines.push(cleaned);
    } else {
      bodyLines.push(stripInlineLabel(trimmed));
    }
  }

  const content = bodyLines.join("\n").trim();
  const notes = visualLines.length
    ? `${visualLabel}：\n${visualLines.join("\n")}`
    : undefined;

  return {
    titleFromBody: titleFromBody || undefined,
    content: content || stripMarkdownBold(raw.replace(SECTION_HEADER, "$1").trim()),
    notes,
  };
}

/** 生成图片前：去掉结构标签，排版说明仅进 visualDirection */
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

  const visualFromBody = parsed.notes
    ?.replace(/^(?:画面|排版设计)\s*[:：]\s*/i, "")
    .trim();
  const visualDirection = [visualFromBody, notes?.trim()]
    .filter(Boolean)
    .join("\n")
    .trim() || undefined;

  return { headline, body, visualDirection };
}
