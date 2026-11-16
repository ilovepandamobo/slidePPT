/**
 * Smoke test: GrsAI 新版 POST /v1/api/generate + 文本 /v1/chat/completions
 * Usage: npx tsx scripts/test-grsai-generate.ts
 */
import "dotenv/config";
import { buildGrsaiGenerateBody } from "../src/lib/ai/grsai";
import { generateWithGrsai } from "../src/lib/ai/grsai";
import { grsaiChatCompletion } from "../src/lib/ai/grsai-chat";
import { getGrsaiApiKeys } from "../src/lib/ai/grsai-keys";

async function main() {
  const key = getGrsaiApiKeys()[0];
  if (!key) {
    console.error("Set GRSAI_API_KEY in .env");
    process.exit(1);
  }

  const base = (
    process.env.GRSAI_BASE_URL || "https://grsai.dakka.com.cn"
  ).replace(/\/$/, "");

  const body = buildGrsaiGenerateBody(
    {
      prompt: "Simple blue presentation slide, no text",
      model: "gpt-image-2",
      aspectRatio: "1672x941",
      quality: "auto",
      referenceUrls: [],
    },
    "gpt-image-2"
  );
  console.log("POST", `${base}/v1/api/generate`, JSON.stringify(body));

  const t0 = Date.now();
  const url = await generateWithGrsai({
    prompt: body.prompt as string,
    model: "gpt-image-2",
    aspectRatio: body.aspectRatio as string,
    quality: "auto",
  });
  console.log(
    "generateWithGrsai",
    url ? "OK" : "FAIL",
    `${Date.now() - t0}ms`,
    url?.slice(0, 80)
  );
  if (!url) process.exit(1);

  const t1 = Date.now();
  const chat = await grsaiChatCompletion({
    messages: [{ role: "user", content: "Reply with exactly: OK" }],
    maxTokens: 10,
  });
  console.log(
    "chat",
    chat ? "OK" : "FAIL",
    `${Date.now() - t1}ms`,
    chat?.slice(0, 40)
  );
  if (!chat) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});