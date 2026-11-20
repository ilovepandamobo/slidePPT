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

  it("detects 上屏/设计 brief markers", () => {
    assert.equal(
      hasStructuredSlideMarkers("- **上屏**　主标题\n- **设计**　左侧大图"),
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

  it("splits 上屏 vs 设计 for airline-style brief", () => {
    const raw = `- **上屏**　“山东航空 WhatsApp”。副标题行程通知。
- **设计**　左侧深蓝遮罩，右侧机身摄影。
- **业务挑战**　旅客切换渠道不便。
- **做法**　① 官网引导订阅`;

    const parsed = parseStructuredPageBody(raw);
    assert.ok(parsed.content.includes("山东航空 WhatsApp"));
    assert.ok(parsed.content.includes("旅客切换渠道"));
    assert.ok(parsed.content.includes("官网引导"));
    assert.ok(!parsed.content.includes("左侧深蓝"));
    assert.ok(parsed.notes?.includes("深蓝遮罩"));
    assert.ok(!parsed.notes?.includes("山东航空 WhatsApp"));

    const prep = prepareSlideContentForImage("法航案例", parsed.content, parsed.notes);
    assert.ok(!prep.body.includes("**设计**"));
    assert.ok(!prep.body.includes("**上屏**"));
    assert.ok(prep.visualDirection?.includes("深蓝遮罩"));
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