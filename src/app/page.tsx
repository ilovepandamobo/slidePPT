import Link from "next/link";
import {
  Sparkles,
  Wand2,
  Layers,
  Download,
  ArrowRight,
  Zap,
  Shield,
  Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TEMPLATES } from "@/lib/templates-data";

const features = [
  {
    icon: Wand2,
    title: "大纲驱动",
    desc: "粘贴每页内容，AI 自动分页、排版，风格全 deck 统一",
  },
  {
    icon: Palette,
    title: "风格锁定",
    desc: "模版库 + 参考图上传，GPT Image 级视觉一致性",
  },
  {
    icon: Layers,
    title: "单页精修",
    desc: "不满意？重生成、改字、删页、拖拽排序随心编辑",
  },
  {
    icon: Download,
    title: "一键导出",
    desc: "PPTX / PDF 即用，在线放映与分享链接",
  },
];

const steps = [
  { n: "01", title: "选风格", desc: "模版库或上传参考 PPT" },
  { n: "02", title: "写大纲", desc: "每页写什么，AI 帮你拆页" },
  { n: "03", title: "生成", desc: "自动设计全部页面并合并" },
];

export default function HomePage() {
  const previewTemplates = TEMPLATES.slice(0, 6);

  return (
    <div>
      <section className="relative overflow-hidden px-4 pb-24 pt-16 sm:px-6 sm:pt-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(139,92,246,0.15),transparent_50%)]" />
        <div className="relative mx-auto max-w-5xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-300">
            <Sparkles className="h-4 w-4" />
            GPT Image 驱动 · 专业演示一键生成
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            <span className="text-gradient">放入大纲</span>
            <br />
            得到整套专业 PPT
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
            无需设计经验。选择参考风格、粘贴每页内容，SlideCraft 自动拟定页数、
            统一视觉、生成全部幻灯片。支持单页重设计、改字、导出 PPTX。
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/create">
              <Button size="lg" className="min-w-[200px]">
                免费开始创作
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/templates">
              <Button variant="secondary" size="lg">
                浏览模版库
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-600">
            演示账号 demo@slidecraft.app / demo123456
          </p>
        </div>
      </section>

      <section className="border-y border-white/5 bg-black/20 px-4 py-16 sm:px-6">
        <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="glass-card rounded-2xl p-6 text-center">
              <div className="text-3xl font-bold text-violet-500/50">{s.n}</div>
              <h3 className="mt-2 text-lg font-semibold text-white">{s.title}</h3>
              <p className="mt-2 text-sm text-slate-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white sm:text-3xl">精选模版</h2>
              <p className="mt-2 text-slate-500">12+ 专业风格，一键套用</p>
            </div>
            <Link href="/templates" className="text-sm text-violet-400 hover:text-violet-300">
              查看全部 →
            </Link>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {previewTemplates.map((t) => (
              <Link
                key={t.id}
                href={`/create?style=${t.id}`}
                className="group overflow-hidden rounded-2xl border border-white/10 transition hover:border-violet-500/40 hover:shadow-xl hover:shadow-violet-500/10"
              >
                <div
                  className="aspect-video"
                  style={{ background: t.preview }}
                />
                <div className="bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-white">{t.name}</h3>
                    <span className="text-xs text-slate-500">{t.category}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                    {t.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/5 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-bold text-white sm:text-3xl">
            为小白设计的完整能力
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div key={f.title} className="glass-card rounded-2xl p-6">
                <f.icon className="h-8 w-8 text-violet-400" />
                <h3 className="mt-4 font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-500">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/5 p-4">
              <Zap className="h-5 w-5 text-amber-400" />
              <span className="text-sm text-slate-300">大纲助手 · AI 写大纲</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/5 p-4">
              <Shield className="h-5 w-5 text-emerald-400" />
              <span className="text-sm text-slate-300">版本历史 · 一键恢复</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/5 p-4">
              <Sparkles className="h-5 w-5 text-violet-400" />
              <span className="text-sm text-slate-300">全 deck 对话改风格</span>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-24 sm:px-6">
        <div className="mx-auto max-w-3xl rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-600/20 to-indigo-600/10 p-10 text-center">
          <h2 className="text-2xl font-bold text-white">准备好惊艳全场了吗？</h2>
          <p className="mt-3 text-slate-400">3 分钟完成你的第一份 AI 专业 PPT</p>
          <Link href="/create" className="mt-6 inline-block">
            <Button size="lg">立即开始</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
