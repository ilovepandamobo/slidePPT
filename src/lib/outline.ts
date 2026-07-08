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
const PAGE_MARKER_RE = new RegExp(`第\\s*${PAGE_NUM}\\s*页`);
const PAGE_SPLIT_RE = new RegExp(
  `(?=第\\s*${PAGE_NUM}\\s*页(?:\\s*[:：]|\\s))`
);
const PAGE_HEADER_LINE_RE = new RegExp(
  `^第\\s*${PAGE_NUM}\\s*页\\s*[:：]?\\s*(.*)$`
);
const PAGE_HEADER_RE = new RegExp(
  `^第\\s*${PAGE_NUM}\\s*页\\s*[:：]?\\s*(.+?)(?:\\r?\\n|$)`
);

/** 解析「第N页：标题」/「第一页 标题」+ 核心内容 + 配图指引 格式 */
function parseChinesePageFormat(raw: string): OutlinePage[] | null {
  if (!PAGE_MARKER_RE.test(raw)) return null;

  const blocks = raw
    .split(PAGE_SPLIT_RE)
    .map((b) => b.trim())
    .filter(Boolean);

  if (blocks.length === 0) return null;

  return blocks.map((block) => {
    const headerMatch = block.match(PAGE_HEADER_RE);
    const pageTitle = headerMatch?.[1]?.trim() || "未命名页面";
    let body = block
      .replace(new RegExp(`^第\\s*${PAGE_NUM}\\s*页\\s*[:：]?[^\\n]*\\n?`), "")
      .trim();

    let notes = "";
    const guideSplit = body.split(/配图指引\s*[:：]?\s*/);
    if (guideSplit.length > 1) {
      body = guideSplit[0].trim();
      notes = guideSplit.slice(1).join("\n").trim();
    }

    body = body.replace(/^核心内容\s*[:：]?\s*/i, "").trim();
    const structured = parseStructuredPageBody(body);
    body = normalizeBullets(structured.content);
    if (structured.notes) {
      notes = notes
        ? `${notes}\n${structured.notes}`
        : structured.notes;
    }

    if (notes) {
      notes = notes.startsWith("配图指引")
        ? notes
        : `配图指引：\n${normalizeBullets(notes.replace(/^画面\s*[:：]\s*/i, ""))}`;
    }

    return {
      pageType: detectPageType(pageTitle),
      title: pageTitle,
      content: body,
      notes: notes || undefined,
    };
  });
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

    if (PAGE_HEADER_LINE_RE.test(line)) {
      flush();
      const title = line.replace(
        new RegExp(`^第\\s*${PAGE_NUM}\\s*页\\s*[:：]?\\s*`),
        ""
      ).trim();
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

/** 用户用「第1页：」/「第一页」等标记时，页数与边界以大纲为准，禁止自动拆页 */
export function hasExplicitPageMarkers(raw: string): boolean {
  return PAGE_MARKER_RE.test(raw);
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
  const trimmed = raw.trim();
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
    name: "JoinSpark 商业方案",
    outline: `第1页：封面
核心内容
●主标题：JoinSpark AI广告素材智能引擎
●副标题：全球社媒广告素材库数据独家联动 | 出海广告投放全链路提效
●底部标注：Pandamobo出品 | 让每一条广告都成为爆款
配图指引
●背景：蓝紫色科技感渐变
●视觉重点：广告素材生成界面预览

第2页：目录
核心内容
1.关于JoinSpark：出海营销智能素材专家
2.出海广告投放四大核心痛点
3.JoinSpark独家差异化优势
4.四大核心能力全解析
5.行业解决方案：电商 | APP | 游戏
配图指引
●左侧数字目录，右侧闭环流程图

第3页：关于JoinSpark
核心内容
●产品定位：Pandamobo旗下聚焦出海营销场景的精准智能素材引擎
●独家优势：接入全球海外社媒广告素材平台深度独家联动
●关键数据：商用素材投放成功率70%+，平均提升转化率15%+
配图指引
●上半部分双品牌背书，下半部分四个数据卡片

第4页：出海广告投放四大核心痛点
核心内容
●标题：90%出海企业都在踩的广告投放坑
1.废片率高：80%用户不会写专业提示词，商用成功率仅10%
2.爆款复刻难：无法快速拆解爆款逻辑，试错成本高
3.盲目试错：不清楚什么素材能跑爆，全凭经验投放
4.协同低效：素材分散管理，协作难度大
配图指引
●2×2痛点卡片网格，红色边框强调`,
  },
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
];
