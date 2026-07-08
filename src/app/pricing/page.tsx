import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "免费版",
    price: "¥0",
    desc: "体验核心功能",
    features: ["每月 3 个项目", "每项目最多 8 页", "标准模版", "带水印导出", "30 生成点数/月"],
    cta: "免费开始",
    href: "/create",
    highlight: false,
  },
  {
    name: "Pro",
    price: "¥99",
    period: "/月",
    desc: "个人专业用户",
    features: [
      "无限项目",
      "无页数限制",
      "Premium 模版",
      "无水印高清导出",
      "500 生成点数/月",
      "版本历史",
      "分享链接",
    ],
    cta: "升级 Pro",
    href: "/register",
    highlight: true,
  },
  {
    name: "团队版",
    price: "¥299",
    period: "/月",
    desc: "5 人团队",
    features: [
      "Pro 全部权益",
      "品牌套件",
      "共享模版库",
      "协作评论",
      "优先客服",
      "SSO（即将推出）",
    ],
    cta: "联系销售",
    href: "/help",
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white">简单透明的定价</h1>
        <p className="mt-3 text-slate-500">按页消耗点数，Pro 用户享受更多额度与无水印导出</p>
      </div>
      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-2xl border p-8 ${
              plan.highlight
                ? "border-violet-500 bg-gradient-to-b from-violet-600/20 to-transparent shadow-xl shadow-violet-500/10"
                : "border-white/10 bg-white/5"
            }`}
          >
            <h2 className="text-xl font-bold text-white">{plan.name}</h2>
            <p className="mt-1 text-sm text-slate-500">{plan.desc}</p>
            <p className="mt-4">
              <span className="text-4xl font-bold text-white">{plan.price}</span>
              {plan.period && (
                <span className="text-slate-500">{plan.period}</span>
              )}
            </p>
            <ul className="mt-6 space-y-3">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                  <Check className="h-4 w-4 shrink-0 text-violet-400" />
                  {f}
                </li>
              ))}
            </ul>
            <Link href={plan.href} className="mt-8 block">
              <Button
                className="w-full"
                variant={plan.highlight ? "default" : "secondary"}
              >
                {plan.cta}
              </Button>
            </Link>
          </div>
        ))}
      </div>
      <p className="mt-8 text-center text-sm text-slate-600">
        点数包：¥19 / 50 页 · ¥49 / 200 页（永不过期）
      </p>
    </div>
  );
}
