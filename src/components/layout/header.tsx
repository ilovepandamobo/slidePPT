"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/create", label: "开始创作" },
  { href: "/remix", label: "PPT 焕新" },
  { href: "/templates", label: "模版中心" },
  { href: "/projects", label: "我的项目" },
  { href: "/pricing", label: "定价" },
  { href: "/help", label: "帮助" },
];

export function Header({ user }: { user?: { name: string | null; email: string } | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#07070f]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/30">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">
            SlideCraft
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-lg px-4 py-2 text-sm transition-colors",
                pathname === item.href
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:text-white"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <Link href="/projects">
                <Button variant="ghost" size="sm" className="text-slate-300">
                  {user.name || user.email.split("@")[0]}
                </Button>
              </Link>
              <Link href="/create">
                <Button size="sm">开始创作</Button>
              </Link>
              <Link href="/remix">
                <Button variant="secondary" size="sm">
                  PPT 焕新
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  登录
                </Button>
              </Link>
              <Link href="/create">
                <Button size="sm">免费开始</Button>
              </Link>
            </>
          )}
        </div>

        <button
          className="md:hidden text-white"
          onClick={() => setOpen(!open)}
          aria-label="菜单"
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/5 bg-[#07070f] p-4 md:hidden">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block py-3 text-slate-300"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <Link href="/create" className="mt-2 block">
            <Button className="w-full">开始创作</Button>
          </Link>
        </div>
      )}
    </header>
  );
}
