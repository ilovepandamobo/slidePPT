import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSlideGenerationPrompt,
  resolveProjectStylePrompt,
} from "./prompts";
import { TEMPLATES } from "@/lib/templates-data";

const template = TEMPLATES[0];

describe("buildSlideGenerationPrompt", () => {
  it("with reference: forbids template blue palette and requires image colors", () => {
    const prompt = buildSlideGenerationPrompt(
      { title: "封面", content: "主标题", pageType: "cover" },
      {
        template,
        hasReferenceImage: true,
        pageIndex: 0,
        totalPages: 4,
        styleToken: "ref-abc",
      }
    );
    assert.ok(prompt.includes("PRIMARY COLOR"));
    assert.ok(prompt.includes("FROM THE REFERENCE IMAGE"));
    assert.ok(prompt.includes("green-themed"));
    assert.ok(prompt.includes("IGNORE"));
    assert.ok(prompt.includes("DISABLED"));
    assert.ok(!prompt.includes("McKinsey") || prompt.includes("Forbidden"));
    assert.ok(!prompt.includes("Style description: Professional McKinsey"));
  });

  it("redesign: treats content as edit instructions, not body copy", () => {
    const prompt = buildSlideGenerationPrompt(
      {
        title: "功能六 | AI 提示词",
        content: "• 原有要点",
        pageType: "content",
      },
      {
        template,
        hasReferenceImage: true,
        isRedesign: true,
        editInstructions:
          "优化后的提示词太简单了，要更高级专业，不要把我这句话贴到图上",
        pageIndex: 5,
        totalPages: 10,
      }
    );
    assert.ok(prompt.includes("EDIT INSTRUCTIONS"));
    assert.ok(prompt.includes("NEVER print the instruction"));
    assert.ok(prompt.includes("更高级专业"));
    assert.ok(!prompt.includes("Must-include body text"));
    assert.ok(!prompt.includes("原有要点"));
  });

  it("strips 标题/内容/画面 labels from generation prompt", () => {
    const prompt = buildSlideGenerationPrompt(
      {
        title: "功能一 | AI 素材生成",
        content: `标题：从需求到成品
内容：
• 要点一
画面：右侧放流程图`,
        pageType: "content",
      },
      { template, hasReferenceImage: false, pageIndex: 1, totalPages: 5 }
    );
    assert.ok(prompt.includes("从需求到成品"));
    assert.ok(prompt.includes("要点一"));
    assert.ok(prompt.includes("右侧放流程图"));
    assert.ok(prompt.includes("do NOT print"));
    assert.ok(!prompt.match(/Must-include[\s\S]*内容：/));
  });

  it("layout remix: uses short Chinese prompt only", () => {
    const prompt = buildSlideGenerationPrompt(
      {
        title: "第 5 页",
        content: "保留原稿截图中的全部文字与数据",
        pageType: "content",
      },
      {
        template,
        hasReferenceImage: true,
        isLayoutRemix: true,
        pageIndex: 4,
        totalPages: 6,
      }
    );
    assert.equal(
      prompt,
      "你是一个专业的 PPT 优化师，只参考图1的设计风格，将图2的内容重新设计排版，不要改变图2的内容，只重新修改风格和排版。"
    );
    assert.ok(!prompt.includes("TWO-IMAGE CONTRACT"));
    assert.ok(!prompt.includes("Must-include body text"));
  });

  it("without reference: uses template palette", () => {
    const prompt = buildSlideGenerationPrompt(
      { title: "封面", content: "x", pageType: "cover" },
      { template, hasReferenceImage: false, pageIndex: 0, totalPages: 2 }
    );
    assert.ok(prompt.includes(template.colors[0]));
    assert.ok(prompt.includes("Template:"));
  });
});

describe("resolveProjectStylePrompt", () => {
  it("drops template prompt when reference exists", () => {
    const r = resolveProjectStylePrompt(
      "data:image/png;base64,xx",
      null,
      "blue template prompt"
    );
    assert.equal(r, null);
  });
});
