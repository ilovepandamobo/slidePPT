import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  aspectRatioForGrsaiModel,
  buildGrsaiGenerateBody,
  extractGrsaiImageUrl,
  qualityForGrsaiModel,
} from "./grsai";

describe("extractGrsaiImageUrl", () => {
  it("reads results[0].url", () => {
    assert.equal(
      extractGrsaiImageUrl({
        id: "1",
        progress: 100,
        status: "succeeded",
        results: [{ url: "https://cdn.example.com/a.png" }],
      }),
      "https://cdn.example.com/a.png"
    );
  });

  it("reads top-level url when progress is 100", () => {
    assert.equal(
      extractGrsaiImageUrl({
        id: "1",
        progress: 100,
        status: "running",
        url: "https://cdn.example.com/b.png",
      }),
      "https://cdn.example.com/b.png"
    );
  });

  it("reads imageUrl field in results", () => {
    assert.equal(
      extractGrsaiImageUrl({
        id: "1",
        progress: 100,
        status: "success",
        results: [{ imageUrl: "https://cdn.example.com/c.png" }],
      }),
      "https://cdn.example.com/c.png"
    );
  });
});

describe("new generate request", () => {
  it("standard models send auto quality, images, and async reply", () => {
    const body = buildGrsaiGenerateBody(
      {
        prompt: "a slide",
        model: "gpt-image-2",
        aspectRatio: "1792x1024",
        quality: "high",
        referenceUrls: ["https://example.com/a.png"],
      },
      "gpt-image-2"
    );
    assert.equal(body.model, "gpt-image-2");
    assert.equal(body.quality, "auto");
    assert.equal(body.aspectRatio, "1672x941");
    assert.equal(body.replyType, "async");
    assert.deepEqual(body.images, ["https://example.com/a.png"]);
    assert.equal("urls" in body, false);
    assert.equal("webHook" in body, false);
  });

  it("always includes images array (even empty)", () => {
    const body = buildGrsaiGenerateBody(
      { prompt: "slide", model: "gpt-image-2", aspectRatio: "1672x941" },
      "gpt-image-2"
    );
    assert.deepEqual(body.images, []);
  });

  it("vip keeps 4K pixels and high quality", () => {
    assert.equal(qualityForGrsaiModel("gpt-image-2-vip", "high"), "high");
    assert.equal(
      aspectRatioForGrsaiModel("gpt-image-2-vip", "3840x2160"),
      "3840x2160"
    );
    assert.equal(qualityForGrsaiModel("gpt-image-2.5", "high"), "auto");
    assert.equal(qualityForGrsaiModel("gpt-image-2.6", "medium"), "auto");
  });
});
