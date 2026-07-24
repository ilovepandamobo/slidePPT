import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  scoreOutlineConfidence,
  shouldUseLlmNormalize,
  looksMultiSlide,
} from "./confidence";
import { parseOutline } from "../outline";
import { validateLlmOutline } from "./llm-normalize";
import type { LlmOutlineResponse } from "./schema";

const JOINSPARK_SNIPPET = `第1页：封面
核心内容
●主标题：JoinSpark AI广告素材智能引擎
第2页：目录
核心内容
1.关于JoinSpark
第3页：关于JoinSpark
核心内容
●产品定位：Pandamobo旗下`;

describe("outline confidence", () => {
  it("scores high for explicit 第N页 with matching page count", () => {
    const pages = parseOutline(JOINSPARK_SNIPPET);
    const { score } = scoreOutlineConfidence(JOINSPARK_SNIPPET, pages);
    assert.ok(score >= 0.85);
    assert.equal(
      shouldUseLlmNormalize(JOINSPARK_SNIPPET, pages, { score, reasons: [] }),
      false
    );
  });

  it("flags ambiguous format as low confidence", () => {
    const raw = `=== 封面 ===
主标题：JoinSpark AI
=== 目录 ===
1. 产品简介
2. 核心痛点
=== 关于我们 ===
产品定位说明文字`;
    const pages = parseOutline(raw);
    assert.equal(pages.length, 1);
    const conf = scoreOutlineConfidence(raw, pages);
    assert.ok(conf.score < 0.85);
    assert.equal(shouldUseLlmNormalize(raw, pages, conf), true);
  });
});

describe("validateLlmOutline", () => {
  it("rejects page count mismatch", () => {
    const result: LlmOutlineResponse = {
      pageCount: 2,
      pages: [
        {
          pageType: "cover",
          title: "A",
          content: "Body A with enough text here",
        },
      ],
    };
    assert.ok(validateLlmOutline("Body A with enough text here", result).includes("page_count_mismatch"));
  });
});
