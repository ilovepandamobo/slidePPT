import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { ConditionalFooter } from "@/components/layout/conditional-footer";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "SlideCraft — AI 一键专业 PPT",
  description:
    "输入大纲与参考风格，AI 自动生成风格统一的专业演示文稿。支持单页重生成、编辑、导出 PPTX/PDF。",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getSession();

  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col gradient-mesh">
        <Header user={user} />
        <main className="flex-1">{children}</main>
        <ConditionalFooter />
      </body>
    </html>
  );
}
