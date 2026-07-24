import type { OutlinePage, PageType } from "@/types";
import { parseStructuredPageBody } from "@/lib/slide-content";

function detectPageType(title: string, sectionHint?: string): PageType {
  const text = `${title} ${sectionHint || ""}`.toLowerCase();
  if (/封面|cover/.test(text)) return "cover";
  if (/目录|toc|agenda|contents/.test(text)) return "toc";
  if (/章节|section|part\s*\d/.test(text)) return "section";
  if (/数据|图表|chart|metrics|统计/.test(text)) return "data";
  if (/结语|结尾|谢谢|感谢聆听|thank|contact|联系我们|q&a|qa|合作/.test(text))
    return "ending";
  if (/配图|图片|image\s*only/.test(text)) return "image";
  return "content";
}

function normalizeBullets(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      const bulletMatch = trimmed.match(/^[●•○◦\-\*]\s*(.+)/);
      if (bulletMatch) return `• ${bulletMatch[1].trim()}`;
      const numMatch = trimmed.match(/^(\d+)[.、．)\]]\s*(.+)/);
      if (numMatch) return `• ${numMatch[2].trim()}`;
      return trimmed;
    })
    .filter(Boolean)
    .join("\n");
}

/** 第1页 / 第一页 / 第十七页 等页码（阿拉伯数字或中文数字，冒号可选） */
const PAGE_NUM = String.raw`(?:\d+|[一二三四五六七八九十百零〇两]+)`;
const PAGE_MARKER_RE = new RegExp(`第\\s*${PAGE_NUM}\\s*页`, "i");
const PAGE_HEADER_LINE_RE = new RegExp(
  `^第\\s*${PAGE_NUM}\\s*页\\s*[:：]?\\s*(.*)$`,
  "i"
);
const PAGE_HEADER_RE = new RegExp(
  `^第\\s*${PAGE_NUM}\\s*页\\s*[:：]?\\s*(.+?)(?:\\r?\\n|$)`,
  "i"
);
const ENGLISH_PAGE_HEADER_RE =
  /^(?:Page|Slide|PPT|幻灯片)\s*(\d+)\s*[:：\-—]?\s*(.*)$/i;
const BRACKET_PAGE_HEADER_RE = new RegExp(
  `^[【\\[]\\s*第\\s*${PAGE_NUM}\\s*页\\s*[】\\]]\\s*(.*)$`,
  "i"
);

/** 统一全角数字/标点、换行，减少「格式细微不同」导致的漏识别 */
export function normalizeOutlineInput(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\u00A0/g, " ")
    .replace(/[\uFF10-\uFF19]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30)
    )
    .replace(/[\uFF01-\uFF5E]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0)
    )
    .trim();
}

function hasEnglishPageMarkers(raw: string): boolean {
  return /(?:^|\n)\s*(?:Page|Slide|PPT|幻灯片)\s*\d+\s*[:：\-—]?/im.test(
    raw
  );
}

function hasBracketPageMarkers(raw: string): boolean {
  return new RegExp(`(?:^|\\n)\\s*[【\\[]\\s*第\\s*${PAGE_NUM}\\s*页`, "im").test(
    raw
  );
}

function isPageHeaderLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (PAGE_HEADER_LINE_RE.test(trimmed)) return true;
  if (BRACKET_PAGE_HEADER_RE.test(trimmed)) return true;
  if (ENGLISH_PAGE_HEADER_RE.test(trimmed)) return true;
  return false;
}

function extractPageTitleFromHeader(headerLine: string): string {
  const line = headerLine.trim();
  for (const re of [
    BRACKET_PAGE_HEADER_RE,
    PAGE_HEADER_LINE_RE,
    ENGLISH_PAGE_HEADER_RE,
  ]) {
    const m = line.match(re);
    if (m) {
      const title = (m[m.length - 1] || "").trim();
      if (title) return title;
    }
  }
  const glued = line.match(new RegExp(`^第\\s*${PAGE_NUM}\\s*页(.+)$`, "i"));
  if (glued?.[1]?.trim()) return glued[1].trim();
  return "未命名页面";
}

function processPageBody(body: string): { content: string; notes?: string } {
  let notes = "";
  const guideSplit = body.split(
    /(?:^|\n)\s*(?:配图指引|画面(?:说明)?|配图(?:要求)?)\s*[:：]?\s*/i
  );
  if (guideSplit.length > 1) {
    body = guideSplit[0].trim();
    notes = guideSplit.slice(1).join("\n").trim();
  }

  body = body
    .replace(/^核心(?:内容|表达)\s*[:：]?\s*/i, "")
    .replace(/^内容(?:建议)?\s*[:：]?\s*/im, "")
    .trim();

  const structured = parseStructuredPageBody(body);
  body = normalizeBullets(structured.content);
  if (structured.titleFromBody && !body.includes(structured.titleFromBody)) {
    body = [`标题：${structured.titleFromBody}`, body].filter(Boolean).join("\n");
  }
  if (structured.notes) {
    notes = notes ? `${notes}\n${structured.notes}` : structured.notes;
  }

  if (notes) {
    notes = notes.startsWith("配图指引")
      ? notes
      : `配图指引：\n${normalizeBullets(notes.replace(/^画面\s*[:：]\s*/i, ""))}`;
  }

  return { content: body, notes: notes || undefined };
}

function parsePageBlock(block: string): OutlinePage {
  const lines = block.split("\n");
  const headerLine = lines[0]?.trim() || "";
  const pageTitle = extractPageTitleFromHeader(headerLine);
  const body = processPageBody(lines.slice(1).join("\n").trim());
  return {
    pageType: detectPageType(pageTitle),
    title: pageTitle,
    content: body.content,
    notes: body.notes,
  };
}

/**
 * 解析「第N页：标题」/「第 1 页：封面」/「第1页封面」/「Page 1:」/「【第1页】」等
 * 仅在行首识别页标记，避免正文里的「参见第2页」误拆
 */
function parseChinesePageFormat(raw: string): OutlinePage[] | null {
  const text = normalizeOutlineInput(raw);
  if (
    !PAGE_MARKER_RE.test(text) &&
    !hasEnglishPageMarkers(text) &&
    !hasBracketPageMarkers(text)
  ) {
    return null;
  }

  const lines = text.split("\n");
  const blocks: string[] = [];
  let current: string[] = [];

  const flush = () => {
    const joined = current.join("\n").trim();
    if (joined) blocks.push(joined);
    current = [];
  };

  for (const line of lines) {
    if (isPageHeaderLine(line)) {
      flush();
      current.push(line);
    } else {
      current.push(line);
    }
  }
  flush();

  if (blocks.length === 0) return null;
  return blocks.map(parsePageBlock);
}

/** Markdown / 混合格式（# 标题、--- 分隔，不误伤正文编号列表） */
function parseMarkdownFormat(raw: string): OutlinePage[] {
  const lines = raw.split("\n");
  const pages: OutlinePage[] = [];
  let current: OutlinePage | null = null;
  let inNotes = false;

  const flush = () => {
    if (current) {
      const structured = parseStructuredPageBody(current.content.trim());
      current.content = normalizeBullets(structured.content);
      if (structured.notes) {
        current.notes = current.notes
          ? `${current.notes.trim()}\n${structured.notes}`
          : structured.notes;
      }
      if (current.notes) current.notes = current.notes.trim();
      pages.push(current);
      current = null;
    }
    inNotes = false;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^---+$/.test(line)) {
      flush();
      continue;
    }

    if (isPageHeaderLine(line)) {
      flush();
      const title = extractPageTitleFromHeader(line);
      current = {
        pageType: detectPageType(title),
        title: title || `第 ${pages.length + 1} 页`,
        content: "",
      };
      continue;
    }

    if (/^#{1,3}\s+/.test(line)) {
      flush();
      const title = line.replace(/^#+\s*/, "").trim();
      current = {
        pageType: detectPageType(title),
        title,
        content: "",
      };
      continue;
    }

    if (/^配图指引\s*[:：]?/.test(line)) {
      inNotes = true;
      if (current) {
        current.notes = (current.notes || "") + line + "\n";
      }
      continue;
    }

    if (/^核心内容\s*[:：]?$/.test(line)) {
      inNotes = false;
      continue;
    }

    if (!current) {
      current = {
        pageType: detectPageType(line),
        title: inferShortTitle(line),
        content: line,
      };
      continue;
    }

    const isBullet =
      /^[●•○◦\-\*]\s/.test(line) || /^\d+[\.\)、．]\s/.test(line);

    if (inNotes) {
      current.notes = (current.notes || "") + line + "\n";
    } else if (isBullet) {
      const bullet = line
        .replace(/^[●•○◦\-\*]\s*/, "")
        .replace(/^\d+[\.\)、．]\s*/, "")
        .trim();
      current.content += (current.content ? "\n" : "") + `• ${bullet}`;
    } else if (line.startsWith(">")) {
      current.notes = (current.notes || "") + line.replace(/^>\s*/, "") + "\n";
    } else {
      current.content += (current.content ? "\n" : "") + line;
    }
  }

  flush();
  return pages;
}

/** 用户用「第1页：」/「第一页」/「Page 1:」等标记时，页数与边界以大纲为准 */
export function hasExplicitPageMarkers(raw: string): boolean {
  const text = normalizeOutlineInput(raw);
  return (
    PAGE_MARKER_RE.test(text) ||
    hasEnglishPageMarkers(text) ||
    hasBracketPageMarkers(text)
  );
}

function hasMarkdownHeaders(raw: string): boolean {
  return /^#{1,3}\s+/m.test(raw);
}

/** 从正文提取短标题（不把正文截断进 title） */
export function inferShortTitle(text: string): string {
  const line = text.split("\n")[0].trim();
  const colonIdx = line.search(/[：:]/);
  if (colonIdx > 0 && colonIdx <= 72) {
    return line.slice(0, colonIdx).trim();
  }
  if (line.length <= 48) return line;
  return `${line.slice(0, 48)}…`;
}

/**
 * 用户直接粘贴一段话（无「第N页」、无 # 标题）→ 单页或多段，正文完整保留
 */
function parseFreeformText(raw: string): OutlinePage[] {
  const paragraphs = raw
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return [];

  return paragraphs.map((para, i) => ({
    pageType: detectPageType(para),
    title: inferShortTitle(para) || `第 ${i + 1} 页`,
    content: normalizeBullets(para),
  }));
}

export function parseOutline(raw: string): OutlinePage[] {
  const trimmed = normalizeOutlineInput(raw);
  if (!trimmed) return [];

  const chinese = parseChinesePageFormat(trimmed);
  if (chinese && chinese.length > 0) return chinese;

  if (!hasExplicitPageMarkers(trimmed) && !hasMarkdownHeaders(trimmed)) {
    const freeform = parseFreeformText(trimmed);
    if (freeform.length > 0) return freeform;
  }

  const markdown = parseMarkdownFormat(trimmed);
  if (markdown.length > 0) return markdown;

  return [];
}

/**
 * 仅对无「第N页」标记的 Markdown 大纲做可选拆分。
 * 有明确页标记时由 AI 在单页内排版，不生成「续N」页。
 */
export function suggestPageSplit(
  pages: OutlinePage[],
  options?: { strictPageBoundaries?: boolean }
): OutlinePage[] {
  if (options?.strictPageBoundaries) {
    return pages;
  }

  const result: OutlinePage[] = [];

  for (const page of pages) {
    if (
      page.pageType === "cover" ||
      page.pageType === "toc" ||
      page.pageType === "section"
    ) {
      result.push(page);
      continue;
    }

    const bulletLines = page.content
      .split("\n")
      .filter((l) => l.trim().startsWith("•"));
    if (bulletLines.length > 12) {
      const chunks: string[][] = [];
      for (let i = 0; i < bulletLines.length; i += 6) {
        chunks.push(bulletLines.slice(i, i + 6));
      }
      chunks.forEach((chunk, i) => {
        result.push({
          ...page,
          title: i === 0 ? page.title : `${page.title}（续${i}）`,
          content: chunk.join("\n"),
        });
      });
    } else {
      result.push(page);
    }
  }
  return result;
}

export function estimateDuration(pages: OutlinePage[]): number {
  return Math.max(1, Math.ceil(pages.length * 1.5));
}

/** 从大纲推断演示文稿标题 */
export function inferPresentationTitle(pages: OutlinePage[], raw: string): string {
  const cover = pages.find((p) => p.pageType === "cover");
  if (cover?.content) {
    const mainTitle = cover.content
      .split("\n")
      .find((l) => /主标题|title/i.test(l) || l.includes("："));
    if (mainTitle) {
      const t = mainTitle.replace(/^[•●\-\*]*\s*/, "").replace(/^主标题\s*[:：]\s*/i, "").trim();
      if (t.length > 2 && t.length < 80) return t;
    }
  }
  if (cover?.title && cover.title !== "封面") return cover.title;
  const m = raw.match(/主标题\s*[:：]\s*(.+)/);
  if (m) return m[1].trim().slice(0, 80);
  return "我的演示文稿";
}

export const OUTLINE_EXAMPLES = [
  {
    name: "产品路演（简版）",
    outline: `# 封面：智能 PPT 助手
# 目录
## 痛点：做 PPT 太费时
- 设计难
- 风格不统一
## 解决方案
- AI 一键生成
- 风格锁定
# 结语：联系我们`,
  },
  {
    name: "商业方案（完整）",
    outline: `第1页：封面
核心内容
●主标题：智能演示文稿助手
●副标题：AI 驱动，五分钟做出专业 PPT
配图指引
●科技蓝渐变背景，居中标题

第2页：目录
核心内容
1.产品简介
2.核心痛点
3.解决方案
4.功能亮点
配图指引
●左侧数字目录，右侧简约图标

第3页：核心痛点
核心内容
●设计耗时：从零排版平均需要数小时
●风格混乱：多页之间视觉不统一
●修改困难：改一版就要重做布局
配图指引
●三列卡片布局，每列一个痛点`,
  },
];
