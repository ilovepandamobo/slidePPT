import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  getHdImagesModelChain,
  getStandardDrawModelChain,
} from "./image-model-fallbacks";

describe("image model fallback chains", () => {
  const prevImages = process.env.GRSAI_IMAGES_MODEL_FALLBACKS;
  const prevDraw = process.env.GRSAI_DRAW_MODEL_FALLBACKS;

  afterEach(() => {
    if (prevImages === undefined) delete process.env.GRSAI_IMAGES_MODEL_FALLBACKS;
    else process.env.GRSAI_IMAGES_MODEL_FALLBACKS = prevImages;
    if (prevDraw === undefined) delete process.env.GRSAI_DRAW_MODEL_FALLBACKS;
    else process.env.GRSAI_DRAW_MODEL_FALLBACKS = prevDraw;
  });

  it("hd chain starts with vip and includes 2.5/2.6 sunburst", () => {
    const chain = getHdImagesModelChain("gpt-image-2-vip");
    assert.equal(chain[0], "gpt-image-2-vip");
    assert.ok(chain.includes("gpt-image-2.5-sunburst"));
    assert.ok(chain.includes("gpt-image-2.6-flare"));
  });

  it("standard chain includes gpt-image-2.5 and gpt-image-2.6", () => {
    const chain = getStandardDrawModelChain("gpt-image-2");
    assert.equal(chain[0], "gpt-image-2");
    assert.ok(chain.includes("gpt-image-2.5"));
    assert.ok(chain.includes("gpt-image-2.6"));
  });

  it("respects env override list", () => {
    process.env.GRSAI_IMAGES_MODEL_FALLBACKS = "nano-banana-2.1,gpt-image-2.6-sunburst";
    const chain = getHdImagesModelChain("gpt-image-2-vip");
    assert.deepEqual(chain, [
      "gpt-image-2-vip",
      "nano-banana-2.1",
      "gpt-image-2.6-sunburst",
    ]);
  });
});