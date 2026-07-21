import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatImagesApiUrls } from "./grsai-images.ts";
import { isOutlineHdGeneration } from "./grsai-hd.ts";
import {
  resolveGrsaiDrawFallbackConfig,
  resolveGrsaiImagesConfig,
} from "./grsai-config.ts";

describe("formatImagesApiUrls", () => {
  it("prefixes local file paths with app url", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
    const urls = formatImagesApiUrls(["/api/files/style-refs/abc.png"]);
    assert.equal(urls[0], "https://example.com/api/files/style-refs/abc.png");
  });
});

describe("isOutlineHdGeneration", () => {
  it("true for outline hd only", () => {
    assert.equal(isOutlineHdGeneration({ imageQuality: "hd" }), true);
    assert.equal(
      isOutlineHdGeneration({ imageQuality: "hd", isLayoutRemix: true }),
      false
    );
  });
});

describe("resolveGrsaiImagesConfig", () => {
  it("uses 4K size for 16:9", () => {
    const c = resolveGrsaiImagesConfig("16:9");
    assert.equal(c.size, "3840x2160");
    assert.equal(c.model, "gpt-image-2-vip");
  });
});

describe("resolveGrsaiDrawFallbackConfig", () => {
  it("uses 1K standard pixels", () => {
    const c = resolveGrsaiDrawFallbackConfig("16:9");
    assert.equal(c.aspectRatio, "1792x1024");
    assert.equal(c.model, "gpt-image-2");
  });
});
