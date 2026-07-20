import Link from "next/link";
import { Button } from "@/components/ui/button";

const OUTLINE_SAMPLE = `第1页：封面
核心内容
●主标题：你的产品名称
●副标题：一句话价值主张
配图指引
●深色渐变背景，标题居中

第2页：目录
核心内容
1.背景与痛点
2.解决方案
3.核心功能
4.总结与展望
配图指引
●左侧目录列表，右侧留白或图标

第3页：核心功能
核心内容
●功能一：AI 智能排版
●功能二：风格一键统一
●功能三：单页快速重设计
配图指引
●三列卡片，每列一个功能点`;

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-white">帮助中心</h1>
      <p className="mt-2 text-slate-400">SlideCraft 使用指南</p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-white">快速开始</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-slate-400">
          <li>
            在
            <Link href="/templates" className="mx-1 text-violet-400 hover:underline">
              模版中心
            </Link>
            选择风格，或上传参考图锁定视觉
          </li>
          <li>
            在
            <Link href="/create" className="mx-1 text-violet-400 hover:underline">
              开始创作
            </Link>
            粘贴大纲，确认智能分页
          </li>
          <li>选择画质后一键生成全部页面</li>
          <li>在编辑器中单页重设计、调整文字、导出 PPTX</li>
        </ol>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-white">大纲怎么写</h2>
        <p className="mt-2 text-sm text-slate-400">
          支持两种写法，系统会自动识别并分页。每页建议包含「核心内容」和「配图指引」两部分。
        </p>

        <div className="mt-6 space-y-6">
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <h3 className="font-medium text-white">方式一：按页标注（推荐）</h3>
            <p className="mt-1 text-sm text-slate-500">适合商业方案、路演等结构化文稿</p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-black/30 p-4 text-xs leading-relaxed text-slate-300">{`第1页：封面
核心内容
●主标题：...
●副标题：...
配图指引
●背景与视觉说明

第2页：目录
核心内容
1.章节一
2.章节二`}</pre>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <h3 className="font-medium text-white">方式二：Markdown 标题</h3>
            <p className="mt-1 text-sm text-slate-500">适合快速草稿，用 # 表示每页标题</p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-black/30 p-4 text-xs leading-relaxed text-slate-300">{`# 封面标题
# 目录
## 章节标题
- 要点一
- 要点二
> 备注：给 AI 的额外说明（不会显示在幻灯片上）
# 结语`}</pre>
          </div>
        </div>
      </section>

      <section id="cases" className="mt-12">
        <h2 className="text-xl font-semibold text-white">示例大纲</h2>
        <p className="mt-2 text-sm text-slate-400">
          复制以下内容到创作页面试用。创作页也提供「一键填入」快捷按钮。
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-4 text-xs leading-relaxed text-slate-300">
          {OUTLINE_SAMPLE}
        </pre>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-white">PPT 焕新（新功能）</h2>
        <p className="mt-2 text-sm text-slate-400">
          已有 PPT 但排版很烂？不用重写大纲，直接上传每页截图即可专业焕新。
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-slate-400">
          <li>
            进入
            <Link href="/remix" className="mx-1 text-amber-400 hover:underline">
              PPT 焕新
            </Link>
            ，上传你喜欢的目标风格参考图
          </li>
          <li>上传现有 PPT 每一页的截图（支持多选批量上传）</li>
          <li>确认页序后一键焕新 — AI 保留全部文字，仅重设计排版</li>
          <li>在编辑器中可继续单页微调、导出 PPTX</li>
        </ol>
        <Link href="/remix" className="mt-4 inline-block">
          <Button variant="secondary">前往 PPT 焕新</Button>
        </Link>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-white">编辑器技巧</h2>
        <ul className="mt-4 space-y-2 text-slate-400">
          <li>
            <span className="text-slate-300">单页重设计</span>
            — 在右侧填写「修改说明」，只改当前页的视觉，不会把说明文字画进幻灯片
          </li>
          <li>
            <span className="text-slate-300">生成本页</span>
            — 空白页可单独生成，无需等全部页面完成
          </li>
          <li>
            <span className="text-slate-300">版本历史</span>
            — 每次重设计会保留历史，可随时回退
          </li>
          <li>
            <span className="text-slate-300">导出</span>
            — 支持 PPTX 与 PDF，Pro 用户无水印
          </li>
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-white">画质选择</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-medium text-white">标准</h3>
            <p className="mt-1 text-sm text-slate-400">生成速度快，适合预览和日常演示</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-medium text-white">高清 4K</h3>
            <p className="mt-1 text-sm text-slate-400">细节更丰富，适合正式汇报和打印</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-500">每次生成会消耗相应点数，可在设置页查看余额。</p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-white">常见问题</h2>
        <dl className="mt-4 space-y-4">
          <div>
            <dt className="font-medium text-slate-300">大纲没有被正确分页？</dt>
            <dd className="mt-1 text-sm text-slate-500">
              请使用「第1页：标题」或「# 标题」明确标注每页起点。也可点击「AI 智能分页」自动拆分。
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-300">幻灯片上出现了「标题：」「内容：」等字样？</dt>
            <dd className="mt-1 text-sm text-slate-500">
              这些是结构标记，系统会自动过滤。若仍出现，请在「修改说明」中描述想要的效果，而非重复粘贴正文。
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-300">生成失败或超时？</dt>
            <dd className="mt-1 text-sm text-slate-500">
              高清模式耗时较长，请稍后重试。若持续失败，可先用标准画质生成，再在编辑器中单页升级。
            </dd>
          </div>
        </dl>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/create">
          <Button>开始创作</Button>
        </Link>
        <Link href="/pricing">
          <Button variant="secondary">查看套餐</Button>
        </Link>
      </div>
    </div>
  );
}
