/**
 * 大纲识别回归：规则解析 + resolveOutline（含 LLM 兜底）
 * 运行: npx tsx scripts/test-outline-formats.ts
 */
import "dotenv/config";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { parseOutline, countExplicitPageMarkers } from "../src/lib/outline";
import {
  scoreOutlineConfidence,
  shouldUseLlmNormalize,
} from "../src/lib/outline/confidence";
import { resolveOutline } from "../src/lib/outline/resolve";
import { isGrsaiChatConfigured } from "../src/lib/ai/grsai-chat";

const EXPORTS = join(process.cwd(), "exports");

type Case = {
  name: string;
  file?: string;
  raw?: string;
  expectedPages: number;
};

const INLINE_CASES: Case[] = [
  {
    name: "JoinSpark 标准 第N页",
    raw: readFileSync(join(EXPORTS, "failed-outline-joinspark-15pages.txt"), "utf8"),
    expectedPages: 15,
  },
  {
    name: "JoinSpark 12页 第 N 页",
    raw: readFileSync(join(EXPORTS, "joinspark-12pages-success-outline.txt"), "utf8"),
    expectedPages: 12,
  },
  {
    name: "WhatsApp ## 第 N 页",
    raw: readFileSync(join(EXPORTS, "whatsapp-exhibition-12pages-outline.md"), "utf8"),
    expectedPages: 12,
  },
  {
    name: "Page N 英文",
    raw: "Page 1: Cover\nBody A\nPage 2: TOC\nItem 1\nPage 3: End",
    expectedPages: 3,
  },
  {
    name: "【第N页】方括号",
    raw: "【第1页】封面\n内容\n【第2页】目录\n内容\n【第3页】结尾",
    expectedPages: 3,
  },
  {
    name: "第一页 中文序数",
    raw: `第一页 封面\n标题报告\n第二页 目录\n1.简介\n第三页 结尾\n谢谢`,
    expectedPages: 3,
  },
  {
    name: "Markdown # 标题",
    raw: `# 封面：产品名
# 目录
- A
- B
## 方案
- 点1
# 结语`,
    expectedPages: 4,
  },
  {
    name: "模糊 === 分段（需 LLM）",
    raw: `=== 封面 ===
主标题：JoinSpark AI
副标题：出海广告
=== 目录 ===
1. 产品简介
2. 核心痛点
3. 解决方案
=== 关于我们 ===
产品定位说明
=== 核心优势 ===
优势一
优势二
=== 结语 ===
谢谢聆听`,
    expectedPages: 5,
  },
  {
    name: "Slide N - 标题（需 LLM）",
    raw: `Slide 1 - Cover
JoinSpark AI Engine
Subtitle here

Slide 2 - Agenda
1. About
2. Pain points
3. Solution

Slide 3 - Summary
Thank you`,
    expectedPages: 3,
  },
  {
    name: "纯段落无页码",
    raw: "Taboola2026 H2开单奖励：签约新客送运动包，数量有限先到先得。",
    expectedPages: 1,
  },
];

function countExpectedFromMarkers(raw: string): number | null {
  const n = countExplicitPageMarkers(raw);
  if (n > 0) return n;
  const md = raw.match(/(?:^|\n)\s*##\s*第\s*\d+\s*页/gi);
  if (md && md.length > 0) return md.length;
  return null;
};

async function runCase(c: Case, useResolve: boolean) {
  const raw = c.raw ?? readFileSync(join(EXPORTS, c.file!), "utf8");
  const rulePages = parseOutline(raw);
  const conf = scoreOutlineConfidence(raw, rulePages);
  const needsLlm = shouldUseLlmNormalize(raw, rulePages, conf);

  let resolvedPages = rulePages;
  let source = "rules" as "rules" | "llm";
  let resolveError: string | null = null;

  if (useResolve) {
    try {
      const resolved = await resolveOutline(raw, { skipLlm: false });
      resolvedPages = resolved.pages;
      source = resolved.source;
      if (resolved.warnings.includes("llm_normalize_failed")) {
        resolveError = "llm_failed";
      }
    } catch (e) {
      resolveError = e instanceof Error ? e.message : "error";
    }
  }

  const ok = resolvedPages.length === c.expectedPages;
  return {
    name: c.name,
    expected: c.expectedPages,
    ruleCount: rulePages.length,
    resolvedCount: resolvedPages.length,
    source,
    confidence: conf.score.toFixed(2),
    needsLlm,
    ok,
    resolveError,
    markerCount: countExpectedFromMarkers(raw),
  };
}

async function main() {
  console.log("GrsAI Chat configured:", isGrsaiChatConfigured());
  console.log("=".repeat(72));

  console.log("\n## 规则解析 only (parseOutline)\n");
  for (const c of INLINE_CASES) {
    const r = await runCase(c, false);
    const flag = r.ok ? "✓" : "✗";
    console.log(
      `${flag} ${r.name.padEnd(28)} expected=${r.expected} got=${r.ruleCount} conf=${r.confidence} llm?=${r.needsLlm}`
    );
  }

  console.log("\n## 混合 resolveOutline (规则 + LLM 兜底)\n");
  const results = [];
  for (const c of INLINE_CASES) {
    const r = await runCase(c, true);
    results.push(r);
    const flag = r.ok ? "✓" : "✗";
    console.log(
      `${flag} ${r.name.padEnd(28)} expected=${r.expected} rules=${r.ruleCount} resolved=${r.resolvedCount} src=${r.source} conf=${r.confidence}${r.resolveError ? ` err=${r.resolveError}` : ""}`
    );
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log("\n" + "=".repeat(72));
  console.log(`混合路径: ${passed}/${results.length} 通过`);
  if (failed.length) {
    console.log("\n未通过:");
    for (const f of failed) {
      console.log(`  - ${f.name}: expected ${f.expected}, got ${f.resolvedCount} (${f.source})`);
    }
  }

  // 批量扫 exports 里有页标记的文件
  console.log("\n## exports/ 目录抽样（规则页数 vs 页标记数）\n");
  const files = readdirSync(EXPORTS).filter((f) => f.endsWith(".txt") || f.endsWith(".md"));
  for (const file of files.slice(0, 8)) {
    const raw = readFileSync(join(EXPORTS, file), "utf8");
    const markers = countExpectedFromMarkers(raw);
    const pages = parseOutline(raw).length;
    const match = markers === null ? "?" : markers === pages ? "✓" : "✗";
    console.log(`${match} ${file.slice(0, 45).padEnd(46)} markers=${markers ?? "-"} parsed=${pages}`);
  }
}

main().catch(console.error);
