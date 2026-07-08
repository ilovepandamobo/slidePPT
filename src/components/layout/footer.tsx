import Link from "next/link";
import { Sparkles } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[#07070f] py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 text-white">
              <Sparkles className="h-5 w-5 text-violet-400" />
              <span className="font-bold">SlideCraft</span>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              AI 一键生成专业 PPT，风格统一，随心编辑。
            </p>
          </div>
          <div>
            <h4 className="font-medium text-white">产品</h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-500">
              <li><Link href="/create" className="hover:text-white">开始创作</Link></li>
              <li><Link href="/templates" className="hover:text-white">模版中心</Link></li>
              <li><Link href="/pricing" className="hover:text-white">定价方案</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-white">资源</h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-500">
              <li><Link href="/help" className="hover:text-white">帮助中心</Link></li>
              <li><Link href="/help#cases" className="hover:text-white">案例库</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-white">账户</h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-500">
              <li><Link href="/settings" className="hover:text-white">设置</Link></li>
              <li><Link href="/login" className="hover:text-white">登录</Link></li>
            </ul>
          </div>
        </div>
        <p className="mt-10 text-center text-xs text-slate-600">
          © {new Date().getFullYear()} SlideCraft. AI 生成内容请人工核对后使用。
        </p>
      </div>
    </footer>
  );
}
