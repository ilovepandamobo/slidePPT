import "dotenv/config";

const apiKey = process.env.GRSAI_IMAGES_API_KEY || process.env.GRSAI_API_KEY;
const base = (process.env.GRSAI_IMAGES_BASE_URL || "https://api.cphone.vip").replace(
  /\/$/,
  ""
);

const tiny =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function tryModel(model: string, size: string) {
  const body = {
    model,
    prompt: "Simple blue slide background, minimal, no text",
    size,
    quality: "high",
    response_format: "url",
    image: [tiny],
  };
  const t0 = Date.now();
  try {
    const res = await fetch(`${base}/v1/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180_000),
    });
    const text = await res.text();
    console.log(
      `[${model}] ${size} HTTP ${res.status} ${Date.now() - t0}ms`,
      text.slice(0, 400)
    );
  } catch (e) {
    const err = e as Error & { cause?: unknown };
    console.log(
      `[${model}] FETCH_ERR ${Date.now() - t0}ms`,
      err.message,
      err.cause ? String(err.cause) : ""
    );
  }
}

async function main() {
  if (!apiKey) {
    console.error("No GRSAI_IMAGES_API_KEY or GRSAI_API_KEY");
    process.exit(1);
  }
  console.log("base", base, "key len", apiKey.length);

  await tryModel("gpt-image-2.6-sunburst", "3840x2160");
  await tryModel("gpt-image-2.6-flare", "3840x2160");
  await tryModel("gpt-image-2-vip", "3840x2160");
  await tryModel("gpt-image-2.6-flare-4k", "3840x2160");
}

main();
