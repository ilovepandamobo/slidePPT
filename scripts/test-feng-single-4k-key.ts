/**
 * Single 4K vip /v1/images/generations per Feng key (diagnostic)
 * railway run env FENG_IMAGES_RETRIES=1 npx tsx scripts/test-feng-single-4k-key.ts
 * railway run env FENG_IMAGES_RETRIES=1 FENG_SINGLE_TEST_KEY=2 npx tsx scripts/test-feng-single-4k-key.ts
 */
import "dotenv/config";
import { fetchFengImages, formatFetchError } from "../src/lib/ai/feng-long-fetch";

const base = (
  process.env.GRSAI_IMAGES_BASE_URL || "https://api.cphone.vip"
).replace(/\/$/, "");
const slot = process.env.FENG_SINGLE_TEST_KEY === "2" ? 2 : 1;
const apiKey = (
  slot === 2
    ? process.env.GRSAI_IMAGES_API_KEY_2
    : process.env.GRSAI_IMAGES_API_KEY
)?.trim();
const tiny =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const TIMEOUT_MS = 420_000;

async function main() {
  if (!apiKey) {
    console.error(`Missing key for slot ${slot}`);
    process.exit(1);
  }
  console.log("base", base);
  console.log("slot", slot);
  console.log("key", `${apiKey.slice(0, 6)}…${apiKey.slice(-4)} (len ${apiKey.length})`);

  const body = {
    model: "gpt-image-2-vip",
    prompt: "Minimal blue slide test single-key diagnostic, no text",
    size: "3840x2160",
    quality: "high",
    response_format: "url",
    image: [tiny],
  };

  const t0 = Date.now();
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
    console.log("status", res.status);
    console.log("elapsed_ms", ms);
    console.log("body_preview", text.slice(0, 500));
    if (!res.ok) process.exit(1);
    if (!text.includes('"url"')) process.exit(2);
  } catch (e) {
    console.error("error", formatFetchError(e));
    process.exit(1);
  }
}

main();
