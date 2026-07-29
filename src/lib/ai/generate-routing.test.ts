import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isOutlineHdGeneration } from "./grsai-hd.ts";
import { resolveGrsaiImagesConfig } from "./grsai-config.ts";

describe("hd generation routing (Feng for all hd including editor edit)", () => {
  it("redesign with hd uses Feng path", () => {
    assert.equal(
      isOutlineHdGeneration({
        imageQuality: "hd",
        isRedesign: true,
      }),
      true
    );
  });

  it("upload reference modify with hd uses Feng path", () => {
    assert.equal(
      isOutlineHdGeneration({
        imageQuality: "hd",
        isUploadReference: true,
      }),
      true
    );
  });

  it("standard quality skips Feng path", () => {
    assert.equal(
      isOutlineHdGeneration({
        imageQuality: "standard",
        isRedesign: true,
      }),
      false
    );
  });

  it("Feng 4K config for editor and outline", () => {
    const feng = resolveGrsaiImagesConfig("16:9");
    assert.equal(feng.size, "3840x2160");
    assert.equal(feng.label, "乘丰 Feng AI · 4K");
  });
});
