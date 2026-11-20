import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import "dotenv/config";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const root = dirname(fileURLToPath(import.meta.url));
const outline = readFileSync(
  join(root, "../exports/shandong-whatsapp-31-outline.md"),
  "utf8"
);

const TARGET_MS = Number(process.env.SHANDONG_AI_TARGET_MS) || 30_000;
const EXPECT_PAGES = Number(process.env.SHANDONG_EXPECT_PAGES) || 31;

async function suggest(forceNormalize) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/outline/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      outline,
      forceNormalize,
      autoSplit: false,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, ms: Date.now() - t0, data };
}

const rules = await suggest(false);
console.log("=== Rules only ===");
console.log({
  ms: rules.ms,
  pages: rules.data.pageCount,
  source: rules.data.source,
});

console.log("\n=== Force AI ===");
const ai = await suggest(true);
const p1 = ai.data.pages?.[0];
console.log({
  ms: ai.ms,
  pages: ai.data.pageCount,
  source: ai.data.source,
  llmFailed: ai.data.llmFailed,
  llmError: ai.data.llmError,
  warnings: ai.data.warnings?.slice?.(0, 6),
  title1: p1?.title,
  content1Len: p1?.content?.length,
  hasDesignInContent: /设计/.test(p1?.content || ""),
});

const pageOk = ai.data.pageCount === EXPECT_PAGES;
const timeOk = ai.ms <= TARGET_MS;
const sourceOk = ai.data.source === "llm" && !ai.data.llmFailed;
const contentOk =
  p1?.content &&
  p1.content.length > 20 &&
  !/^设计/.test(p1.content.trim());

if (!pageOk || !timeOk || !sourceOk || !contentOk) {
  console.error("\nFAILED", {
    pageOk,
    timeOk,
    sourceOk,
    contentOk,
    targetMs: TARGET_MS,
  });
  process.exit(1);
}
console.log(`\nPASSED: ${EXPECT_PAGES}p force AI in ${ai.ms}ms (<= ${TARGET_MS}ms).`);