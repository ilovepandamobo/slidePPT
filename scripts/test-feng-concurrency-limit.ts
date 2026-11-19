/**
 * 单乘丰 API Key 4K 并发边界探测（2→6 路，每档一轮，档间冷却）
 * railway run env FENG_IMAGES_RETRIES=1 npx tsx scripts/test-feng-concurrency-limit.ts
 */
import "dotenv/config";
import { fetchFengImages, formatFetchError } from "../src/lib/ai/feng-long-fetch";

const base = (
  process.env.GRSAI_IMAGES_BASE_URL || "https://api.cphone.vip"
).replace(/\/$/, "");
/** FENG_CONCURRENCY_TEST_KEY=2 时用第二个乘丰账号 */
const apiKey = (
  process.env.FENG_CONCURRENCY_TEST_KEY === "2"
    ? process.env.GRSAI_IMAGES_API_KEY_2
    : process.env.GRSAI_IMAGES_API_KEY
)?.trim();
const tiny =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const LEVELS = [2, 3, 4, 5, 6];
const COOLDOWN_MS = 15_000;
const TIMEOUT_MS = 420_000;

type Outcome = { ok: boolean; ms: number; detail: string };

async function one4K(tag: string): Promise<Outcome> {
  const t0 = Date.now();
  const body = {
    model: "gpt-image-2-vip",
    prompt: `Minimal blue slide test ${tag}, no text`,
    size: "3840x2160",
    quality: "high",
    response_format: "url",
    image: [tiny],
  };
  try {
    const res = await fetchFengImages(
      `${base}/v1/images/generations`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
      TIMEOUT_MS
    );
    const text = await res.text();
    const ms = Date.now() - t0;
    if (!res.ok) {
      let msg = text.slice(0, 120);
      try {
        const j = JSON.parse(text) as { error?: { message?: string } };
        msg = j.error?.message || msg;
      } catch {
        /* keep slice */
      }
      return { ok: false, ms, detail: `HTTP ${res.status} ${msg}` };
    }
    if (text.includes('"url"')) return { ok: true, ms, detail: "200 + url" };
    return { ok: false, ms, detail: "200 no url" };
  } catch (e) {
    return {
      ok: false,
      ms: Date.now() - t0,
      detail: formatFetchError(e),
    };
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!apiKey) {
    console.error("Set GRSAI_IMAGES_API_KEY (single-key test uses key 1 only)");
    process.exit(1);
  }
  console.log("base", base);
  console.log("key", `${apiKey.slice(0, 6)}…${apiKey.slice(-4)}`);
  console.log("levels", LEVELS.join(", "), "4K vip, cooldown", COOLDOWN_MS, "ms\n");

  const summary: { n: number; ok: number; fail: number; maxMs: number }[] = [];

  for (const n of LEVELS) {
    console.log(`=== concurrency ${n} ===`);
    const tRound = Date.now();
    const results = await Promise.all(
      Array.from({ length: n }, (_, i) => one4K(`c${n}-w${i}`))
    );
    const ok = results.filter((r) => r.ok).length;
    const fail = n - ok;
    results.forEach((r, i) => {
      console.log(
        `  #${i + 1} ${r.ok ? "OK" : "FAIL"} ${Math.round(r.ms / 1000)}s ${r.detail}`
      );
    });
    console.log(
      `  → ${ok}/${n} ok, round ${Math.round((Date.now() - tRound) / 1000)}s\n`
    );
    summary.push({
      n,
      ok,
      fail,
      maxMs: Math.max(...results.map((r) => r.ms)),
    });
    if (ok === 0) {
      console.log("All failed at this level; stopping upward probe.");
      break;
    }
    if (n !== LEVELS[LEVELS.length - 1]) await sleep(COOLDOWN_MS);
  }

  console.log("--- summary ---");
  let stableMax = 1;
  for (const row of summary) {
    const rate = row.ok / row.n;
    const label =
      rate >= 1 ? "stable" : rate >= 0.5 ? "partial" : "unstable";
    console.log(`  n=${row.n}: ${row.ok}/${row.n} (${label})`);
    if (rate >= 1) stableMax = row.n;
    else if (rate >= 0.5 && stableMax < row.n) stableMax = row.n - 1;
  }
  console.log(
    `\nSuggested GENERATION_CONCURRENCY per Feng key (4K): ${Math.max(1, stableMax)}`
  );
  console.log(
    "With 2 keys, app caps HD parallel at min(keyCount, 2) — scale total ~ keys × per-key limit."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
