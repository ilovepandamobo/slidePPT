import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseOutline,
  suggestPageSplit,
  inferPresentationTitle,
  hasExplicitPageMarkers,
} from "./outline";

const JOINSPARK_SNIPPET = `第1页：封面
核心内容
●主标题：JoinSpark AI广告素材智能引擎
●副标题：全球社媒广告素材库数据独家联动
配图指引
●背景：蓝紫色科技感渐变

第2页：目录
核心内容
1.关于JoinSpark：出海营销智能素材专家
2.出海广告投放四大核心痛点
3.JoinSpark独家差异化优势

第3页：关于JoinSpark
核心内容
●产品定位：Pandamobo旗下聚焦出海营销场景

第4页：出海广告投放四大核心痛点
核心内容
1.废片率高：商用成功率仅10%
2.爆款复刻难：试错成本高`;

const PAGE5_TABLE = `第5页：JoinSpark独家差异化优势
核心内容
●标题：不止是AI生成工具，更是您的投放策略伙伴
●对比表（传统AI素材工具 vs JoinSpark）：
维度	传统AI素材工具	JoinSpark智能素材引擎
数据支撑	无行业数据，纯生成	全球社媒广告素材库10亿+广告素材独家联动
核心能力	仅素材生成	爆款洞察→拆解复刻→AI生成→效果优化全链路
成功率	行业平均10%	70%+投放级素材成功率
策略指导	无	AI广告策略报告+竞品投放洞察
团队协同	基础功能	AI无限画布+项目化管理+团队素材库
价值交付	交付素材	交付投放效果与ROI提升
配图指引
●JoinSpark优势项用蓝色背景突出
●右侧添加"全链路闭环"示意图`;

const JOINSPARK_FIVE_PAGES = `${JOINSPARK_SNIPPET}\n\n${PAGE5_TABLE}`;

describe("parseOutline", () => {
  it("parses 第N页 format into exact page count", () => {
    const pages = parseOutline(JOINSPARK_SNIPPET);
    assert.equal(pages.length, 4);
    assert.equal(pages[0].pageType, "cover");
    assert.equal(pages[0].title, "封面");
    assert.ok(pages[0].content.includes("JoinSpark AI"));
    assert.equal(pages[1].pageType, "toc");
    assert.ok(pages[1].content.includes("关于JoinSpark"));
    assert.equal(pages[2].title, "关于JoinSpark");
    assert.ok(pages[3].title.includes("痛点"));
  });

  it("puts 配图指引 into notes", () => {
    const pages = parseOutline(JOINSPARK_SNIPPET);
    assert.ok(pages[0].notes?.includes("配图指引"));
    assert.ok(pages[0].notes?.includes("蓝紫色"));
  });

  it("does not split TOC numbered items into separate pages", () => {
    const split = suggestPageSplit(parseOutline(JOINSPARK_SNIPPET));
    assert.equal(split.length, 4);
  });

  it("detects explicit 第N页 markers", () => {
    assert.equal(hasExplicitPageMarkers(JOINSPARK_SNIPPET), true);
    assert.equal(hasExplicitPageMarkers("# 标题\n内容"), false);
  });

  it("keeps 5 pages when user defines 第1-5页 including table-heavy page 5", () => {
    const pages = parseOutline(JOINSPARK_FIVE_PAGES);
    assert.equal(pages.length, 5);
    assert.equal(pages[4].title, "JoinSpark独家差异化优势");
    assert.ok(pages[4].content.includes("对比表"));
    assert.ok(pages[4].content.includes("价值交付"));

    const strict = suggestPageSplit(pages, { strictPageBoundaries: true });
    assert.equal(strict.length, 5);
    assert.ok(!strict.some((p) => /续\d*/.test(p.title)));

    const loose = suggestPageSplit(pages);
    assert.equal(loose.length, 5);
    assert.ok(!loose.some((p) => /续\d*/.test(p.title)));
  });
});

const TABOOLA_PARA = `Taboola2026 H2开单奖励：为鼓励更多销售参与开拓Taboola客户自2026年6月1日起，签约Taboola新客，并开始消费的销售(或Upsell成功的am）将会获得精美的taboola运动包一个！数量有限先到先得！`;

const ZHUANZHENG_SNIPPET = `第一页 封面
生成封面页。标题为"2026转正述职报告"。页面包含以下信息：事业部：海外互联网事业部。
第二页 目录页
生成目录页，标题为"目录"。目录包含六项：1、自我介绍；2、工作内容及完成情况。
第三页 自我介绍
生成自我介绍页。现任职位：数传海外互联网自投业务部-客户经理（AM）；姓名：牛绍斌。
第十七页 结尾页
生成结尾页，内容为"感谢聆听 / Q&A"。`;

describe("parseOutline chinese ordinal pages", () => {
  it("parses 第一页 / 第二页 format without colon", () => {
    const pages = parseOutline(ZHUANZHENG_SNIPPET);
    assert.equal(pages.length, 4);
    assert.equal(pages[0].pageType, "cover");
    assert.equal(pages[0].title, "封面");
    assert.ok(pages[0].content.includes("2026转正述职报告"));
    assert.equal(pages[1].pageType, "toc");
    assert.equal(pages[1].title, "目录页");
    assert.equal(pages[2].title, "自我介绍");
    assert.equal(pages[3].pageType, "ending");
    assert.equal(pages[3].title, "结尾页");
  });

  it("detects 第一页 as explicit page markers", () => {
    assert.equal(hasExplicitPageMarkers(ZHUANZHENG_SNIPPET), true);
    assert.equal(
      suggestPageSplit(parseOutline(ZHUANZHENG_SNIPPET), {
        strictPageBoundaries: true,
      }).length,
      4
    );
  });
});

describe("parseOutline freeform", () => {
  it("keeps full paragraph when pasted without 第N页 markers", () => {
    const pages = parseOutline(TABOOLA_PARA);
    assert.equal(pages.length, 1);
    assert.equal(pages[0].title, "Taboola2026 H2开单奖励");
    assert.ok(pages[0].content.includes("数量有限先到先得"));
    assert.ok(pages[0].content.includes("Upsell成功的am"));
    assert.equal(pages[0].content.length, TABOOLA_PARA.length);
  });
});

describe("inferPresentationTitle", () => {
  it("extracts title from cover", () => {
    const pages = parseOutline(JOINSPARK_SNIPPET);
    const title = inferPresentationTitle(pages, JOINSPARK_SNIPPET);
    assert.ok(title.includes("JoinSpark"));
  });
});
