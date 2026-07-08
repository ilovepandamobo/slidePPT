"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{
    email: string;
    name: string | null;
    plan: string;
    credits: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) router.push("/login?redirect=/settings");
        else setUser(d.user);
      });
  }, [router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  if (!user) return <div className="p-10 text-center text-slate-500">加载中...</div>;

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-white">账户设置</h1>
      <Card className="mt-8">
        <CardContent className="space-y-4 pt-6">
          <CardTitle>个人信息</CardTitle>
          <div>
            <label className="text-xs text-slate-500">邮箱</label>
            <Input className="mt-1" value={user.email} disabled />
          </div>
          <div>
            <label className="text-xs text-slate-500">套餐</label>
            <p className="mt-1 text-white capitalize">{user.plan}</p>
          </div>
          <div>
            <label className="text-xs text-slate-500">剩余点数</label>
            <p className="mt-1 text-2xl font-bold text-violet-400">{user.credits}</p>
          </div>
          <div className="border-t border-white/10 pt-4">
            <h3 className="text-sm font-medium text-white">品牌套件（Pro）</h3>
            <p className="mt-1 text-xs text-slate-500">
              设置主色、Logo 后可在创建时自动应用
            </p>
            <Input className="mt-2" placeholder="主色 #8b5cf6" disabled={user.plan === "free"} />
          </div>
          <Button variant="destructive" onClick={logout} className="w-full">
            退出登录
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
