import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveGrsaiDrawConfig } from "./grsai-config.ts";

describe("resolveGrsaiDrawConfig", () => {
  it("standard uses gpt-image-2 and 16:9 pixels", () => {
    const c = resolveGrsaiDrawConfig("16:9", "standard");
    assert.equal(c.model, "gpt-image-2");
    assert.equal(c.aspectRatio, "1672x941");
  });

  it("hd uses vip 4K for 16:9", () => {
    const c = resolveGrsaiDrawConfig("16:9", "hd");
    assert.equal(c.model, "gpt-image-2-vip");
    assert.equal(c.aspectRatio, "3840x2160");
  });

  it("hd 4:3 uses vip 4K only", () => {
    const c = resolveGrsaiDrawConfig("4:3", "hd");
    assert.equal(c.aspectRatio, "3264x2448");
  });

  it("standard 4:3 and 9:16 use documented 1K pixels", () => {
    assert.equal(resolveGrsaiDrawConfig("4:3", "standard").aspectRatio, "1443x1090");
    assert.equal(resolveGrsaiDrawConfig("9:16", "standard").aspectRatio, "941x1672");
  });
});
