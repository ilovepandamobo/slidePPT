/**
 * 验证乘丰双密钥分流：key 槽位与轮询
 * railway run npx tsx scripts/test-feng-dual-keys.ts
 */
import "dotenv/config";
import {
  getFengImagesApiKeys,
  generateWithGrsaiImages,
} from "../src/lib/ai/grsai-images";

const tiny =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function maskKey(k: string): string {
  if (k.length < 12) return "(short)";
  return `${k.slice(0, 6)}…${k.slice(-4)} (len ${k.length})`;
}

async function main() {
  const keys = getFengImagesApiKeys();
  console.log("Feng key count:", keys.length);
  keys.forEach((k, i) => console.log(`  key ${i + 1}:`, maskKey(k)));
  if (keys.length < 2) {
    console.error("Need GRSAI_IMAGES_API_KEY + GRSAI_IMAGES_API_KEY_2 on env");
    process.exit(1);
  }

  const params = {
    prompt: "Simple blue presentation slide background, minimal, no text",
    size: "3840x2160",
    model: "gpt-image-2-vip",
    quality: "high" as const,
    referenceUrls: [tiny],
  };

  console.log("\n--- parallel slot 0 + slot 1 (watch log tags key 1/2 vs 2/2) ---");
  const t0 = Date.now();
  const [a, b] = await Promise.all([
    generateWithGrsaiImages(params, { keySlotIndex: 0 }),
    generateWithGrsaiImages(params, { keySlotIndex: 1 }),
  ]);
  console.log("\nResults:", Date.now() - t0, "ms");
  console.log("  slot 0:", a ? "OK " + a.slice(0, 60) : "null");
  console.log("  slot 1:", b ? "OK " + b.slice(0, 60) : "null");

  if (a && b) {
    console.log("\nDual-key parallel 4K: both succeeded.");
    process.exit(0);
  }
  if (a || b) {
    console.log("\nPartial success (one key/upstream may be busy).");
    process.exit(0);
  }
  console.log("\nBoth failed — check Railway/cphone upstream, not necessarily routing.");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
