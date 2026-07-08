import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractGrsaiImageUrl } from "./grsai";

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
