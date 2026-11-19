/**
 * Production smoke: rules path (### 01) + optional AI force path
 */
const BASE = process.env.BASE_URL || "https://slideppt-production.up.railway.app";

const RULES_BRIEF = `# 航旅出海 WhatsApp 行业通案

### 原稿改版对照
（前言不入页）

### 01　封面｜航空公司出海 WhatsApp 行业方案
- **上屏**　主标题

### 02　目录
- **上屏**　三项目录

### 03　WhatsApp Business Platform 产品简介
- **上屏**　定位

### A　拉美市场｜替换区域页
- **上屏**　巴西数据
`;

const AI_BRIEF = `做一个 3 页产品介绍 PPT 大纲，用 Markdown：
第1页：封面，产品名 SlideCraft
第2页：功能，列出 AI 大纲、4K 生图
第3页：结尾，谢谢聆听`;

async function suggest(outline, forceNormalize = false) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/outline/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ outline, forceNormalize, autoSplit: false }),
    signal: AbortSignal.timeout(320_000),
  });
  const data = await res.json();
  const ms = Date.now() - t0;
  return { ok: res.ok, status: res.status, ms, data };
}

async function main() {
  console.log("BASE", BASE);

  const rules = await suggest(RULES_BRIEF, false);
  console.log("\n=== Rules (### 01), forceNormalize=false ===");
  console.log("status", rules.status, "ms", rules.ms);
  console.log(
    "pages",
    rules.data.pageCount,
    "source",
    rules.data.source,
    "confidence",
    rules.data.confidence
  );
  console.log("titles", rules.data.pages?.map((p) => p.title));
  if (rules.data.llmFailed) console.log("llmFailed", rules.data.llmError);
  if (
    !rules.ok ||
    rules.data.pageCount !== 4 ||
    rules.data.source !== "rules" ||
    rules.ms > 5000
  ) {
    process.exitCode = 1;
    console.error("RULES TEST FAILED", rules.data.error || rules.data);
  }

  console.log("\n=== AI forceNormalize=true (3-page 第N页 brief) ===");
  const ai = await suggest(AI_BRIEF, true);
  console.log("status", ai.status, "ms", ai.ms);
  console.log(
    "pages",
    ai.data.pageCount,
    "source",
    ai.data.source,
    "llmFailed",
    ai.data.llmFailed
  );
  console.log("titles", ai.data.pages?.map((p) => p.title));
  if (!ai.ok || !ai.data.pages?.length) {
    process.exitCode = 1;
    console.error("AI TEST FAILED", ai.data.error || ai.data.llmError);
    return;
  }
  const aiOk =
    ai.data.source === "llm" ||
    (ai.data.source === "rules" && !ai.data.llmFailed && ai.data.pageCount >= 3);
  if (!aiOk) {
    process.exitCode = 1;
    console.error("AI path did not return usable pages");
  } else {
    console.log("\nAll production outline tests passed.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});