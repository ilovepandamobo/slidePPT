import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = process.env.BASE_URL || "https://slideppt-production.up.railway.app";
const root = dirname(fileURLToPath(import.meta.url));
const outline = readFileSync(
  join(root, "../exports/whatsapp-airline-full-outline.md"),
  "utf8"
);

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
    signal: AbortSignal.timeout(600_000),
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
  llmFailed: rules.data.llmFailed,
});

console.log("\n=== Force AI (your 用 AI 重新识别) ===");
const ai = await suggest(true);
const p5 = ai.data.pages?.[4];
console.log({
  ms: ai.ms,
  pages: ai.data.pageCount,
  source: ai.data.source,
  llmFailed: ai.data.llmFailed,
  llmError: ai.data.llmError,
  warnings: ai.data.warnings?.slice?.(0, 8),
  title1: ai.data.pages?.[0]?.title,
  title25: ai.data.pages?.[24]?.title,
  titleA: ai.data.pages?.find((p) => p.title?.includes("拉美"))?.title,
  page5ContentLen: p5?.content?.length,
});
const contentOk = p5?.content && p5.content.length > 80;
const pass =
  ai.ok &&
  ai.data.pageCount === 29 &&
  ai.data.source === "llm" &&
  !ai.data.llmFailed &&
  contentOk;

if (!pass) {
  console.error("\nFAILED", ai.data.error || ai.data);
  process.exit(1);
}
console.log("\nPASSED: full 航旅稿 force AI on production.");