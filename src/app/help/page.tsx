import Link from "next/link";
import { Button } from "@/components/ui/button";
import { OUTLINE_EXAMPLES } from "@/lib/outline";

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-white">帮助中心</h1>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-white">快速开始</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-slate-400">
          <li>在「模版中心」选择风格，或上传参考图</li>
          <li>在「开始创作」粘贴大纲，使用 # 表示每页标题</li>
          <li>确认智能分页后，一键生成全部页面</li>
          <li>在编辑器中单页重设计、改字、导出 PPTX</li>
        </ol>
      </section>

      <section id="cases" className="mt-12">
        <h2 className="text-xl font-semibold text-white">案例大纲</h2>
        <p className="mt-2 text-sm text-slate-500">复制以下大纲到创作页面试用</p>
        {OUTLINE_EXAMPLES.map((ex) => (
          <pre
            key={ex.name}
            className="mt-4 overflow-x-auto rounded-xl bg-white/5 p-4 text-xs text-slate-300"
          >
            <strong className="text-violet-400">{ex.name}</strong>
            {"\n"}
            {ex.outline}
          </pre>
        ))}
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-white">大纲格式</h2>
        <pre className="mt-4 rounded-xl bg-white/5 p-4 text-sm text-slate-400">{`# 封面标题
# 目录
## 章节标题
- 要点一
- 要点二
> 备注：给 AI 的额外说明
# 结语`}</pre>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-white">配置 GPT Image 2（GrsAI）</h2>
        <p className="mt-2 text-slate-400">
          创建时可选择「标准」(gpt-image-2) 或「高清 4K」(gpt-image-2-vip)。
          在 .env 中配置 GRSAI_API_KEY 后，幻灯片由 GrsAI 生成（国内节点
          grsai.dakka.com.cn）。生成结果会自动缓存到本地数据库，避免 2 小时链接过期。
          未配置时回退到内置 SVG 渲染。
        </p>
        <pre className="mt-4 rounded-xl bg-white/5 p-4 text-xs text-slate-400">{`GRSAI_API_KEY=sk-...
GRSAI_BASE_URL=https://grsai.dakka.com.cn
GRSAI_MODEL=gpt-image-2`}</pre>
      </section>

      <Link href="/create" className="mt-10 inline-block">
        <Button>开始创作</Button>
      </Link>
    </div>
  );
}
