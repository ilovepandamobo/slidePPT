import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseStructuredPageBody,
  prepareSlideContentForImage,
  hasStructuredSlideMarkers,
} from "./slide-content";

describe("slide-content", () => {
  it("detects 标题/内容/画面 markers", () => {
    assert.equal(
      hasStructuredSlideMarkers("标题：副标题\n内容：\n• a"),
      true
    );
  });

  it("parses structured body into content and visual notes", () => {
    const raw = `标题：从需求到成品，快速生成广告素材
内容：
• 支持图片、视频、文案等广告素材生成
• 素材 + 模型组合
画面：展示产品网页、素材生成界面`;

    const parsed = parseStructuredPageBody(raw);
    assert.equal(
      parsed.titleFromBody,
      "从需求到成品，快速生成广告素材"
    );
    assert.ok(parsed.content.includes("支持图片"));
    assert.ok(!parsed.content.includes("内容："));
    assert.ok(parsed.notes?.includes("展示产品网页"));
  });

  it("prepareSlideContentForImage strips labels from prompt fields", () => {
    const prep = prepareSlideContentForImage(
      "功能一 | AI 素材生成",
      `标题：从需求到成品，快速生成广告素材
内容：
• 支持图片、视频、文案等广告素材生成
画面：展示产品网页`,
      null
    );
    assert.equal(prep.headline, "从需求到成品，快速生成广告素材");
    assert.ok(!prep.body.includes("内容："));
    assert.ok(prep.visualDirection?.includes("展示产品网页"));
  });
});
