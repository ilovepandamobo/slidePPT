"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Check,
  Sparkles,
  Palette,
  Images,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { StyleReferenceUpload } from "@/components/create/style-reference-upload";
import { PageScreenshotUpload } from "@/components/remix/page-screenshot-upload";
import { ImageQualitySelect } from "@/components/create/image-quality-select";
import type { ImageQuality } from "@/lib/ai/grsai-config";
import { resolveGrsaiDrawConfig } from "@/lib/ai/grsai-config";
import type { RemixPageUpload } from "@/types";
import { cn } from "@/lib/utils";
import {
  parseGenerateResponse,
  summarizeGenerateResult,
} from "@/lib/generate-response";

const STEPS = ["目标风格", "原稿截图", "确认焕新"];

const REMIX_CONTENT =
  "保留原稿截图中的全部文字与数据，仅重新设计排版与视觉风格。";

function RemixWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [genProgress, setGenProgress] = useState("");

  const [styleRef, setStyleRef] = useState<string | null>(null);
  const [stylePrompt, setStylePrompt] = useState("");
  const [pages, setPages] = useState<RemixPageUpload[]>([]);
  const [title, setTitle] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [imageQuality, setImageQuality] = useState<ImageQuality>("standard");

  async function handleGenerate() {
    setLoading(true);
    setError("");
    let projectId: string | null = null;
    try {
      const meRes = await fetch("/api/auth/me");
      const me = await meRes.json();
      if (!me.user) {
        router.push("/login?redirect=/remix");
        return;
      }

      const projectTitle =
        title.trim() ||
        `PPT 焕新 · ${new Date().toLocaleDateString("zh-CN")}`;

      const createRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: projectTitle,
          generationMode: "remix",
          styleReference: styleRef,
          stylePrompt: stylePrompt.trim() || undefined,
          aspectRatio,
          imageQuality,
          pages: pages.map((p, i) => ({
            pageType: i === 0 ? "cover" : "content",
            title: `第 ${i + 1} 页`,
            content: REMIX_CONTENT,
            layoutReference: p.url,
          })),
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        throw new Error(createData.error || "创建项目失败");
      }

      projectId = createData.project.id as string;
      const drawLabel = resolveGrsaiDrawConfig(aspectRatio, imageQuality).label;
      setGenProgress(
        `${drawLabel} 正在焕新 ${pages.length} 页（保留原稿内容，重设计排版）…`
      );

      const genRes = await fetch(`/api/projects/${projectId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const genData = await parseGenerateResponse(genRes);
      const summary = summarizeGenerateResult(genData);

      if (projectId) {
        if (summary) setError(summary);
        router.push(`/editor/${projectId}`);
        return;
      }

      if (!genRes.ok || genData.allFailed) {
        throw new Error(genData.error || "生成失败");
      }

      router.push(`/editor/${projectId}`);
    } catch (e) {
      if (projectId) {
        router.push(`/editor/${projectId}`);
        setError(
          `${e instanceof Error ? e.message : "焕新异常"}。项目已创建，请到编辑器查看是否已有部分页面完成。`
        );
      } else {
        setError(e instanceof Error ? e.message : "焕新失败");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-300">
        <Sparkles className="h-3.5 w-3.5" />
        新功能 · PPT 焕新
      </div>
      <h1 className="text-2xl font-bold text-white">PPT 焕新</h1>
      <p className="mt-2 text-sm text-slate-400">
        已有 PPT 排版很烂？上传每页截图 + 喜欢的风格参考，AI
        保留全部文字内容，只做专业重设计。
      </p>

      <div className="mt-8 flex gap-2">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={cn(
              "flex flex-1 items-center gap-2 rounded-xl px-4 py-3 text-sm",
              i === step
                ? "border border-violet-500/30 bg-violet-600/20 text-violet-300"
                : i < step
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-white/5 text-slate-500"
            )}
          >
            {i < step ? <Check className="h-4 w-4" /> : <span>{i + 1}</span>}
            {s}
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-4 whitespace-pre-wrap rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {genProgress && loading && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-violet-500/10 px-4 py-3 text-sm text-violet-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          {genProgress}
        </div>
      )}

      {step === 0 && (
        <div className="mt-8 space-y-6">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-violet-400" />
                上传你喜欢的目标风格
              </CardTitle>
              <p className="text-xs text-slate-500">
                找一张你觉得好看的专业 PPT 作为风格参考。AI
                只提取配色、字体气质和装饰风格；风格图上的标题、正文、数据
                <span className="text-amber-400/90"> 不会 </span>
                出现在你的成片中。
              </p>
              <StyleReferenceUpload
                value={styleRef}
                onChange={(url) => setStyleRef(url)}
              />
              <div>
                <label className="text-sm text-slate-400">
                  风格补充说明（可选）
                </label>
                <Textarea
                  className="mt-2"
                  placeholder="例如：更商务、留白多一些、深色背景..."
                  value={stylePrompt}
                  onChange={(e) => setStylePrompt(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm text-slate-400">画幅比例</label>
                <div className="mt-2 flex gap-2">
                  {["16:9", "4:3", "9:16"].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setAspectRatio(r)}
                      className={cn(
                        "rounded-lg px-4 py-2 text-sm",
                        aspectRatio === r
                          ? "bg-violet-600 text-white"
                          : "bg-white/5 text-slate-400"
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <ImageQualitySelect
                value={imageQuality}
                onChange={setImageQuality}
              />
            </CardContent>
          </Card>
          <div className="flex justify-between">
            <Link href="/">
              <Button variant="ghost">
                <ChevronLeft className="h-4 w-4" />
                返回首页
              </Button>
            </Link>
            <Button onClick={() => setStep(1)} disabled={!styleRef}>
              下一步
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="mt-8 space-y-6">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <CardTitle className="flex items-center gap-2">
                <Images className="h-5 w-5 text-violet-400" />
                上传你的 PPT 原稿截图
              </CardTitle>
              <p className="text-xs text-slate-500">
                把你现有 PPT 每一页导出为图片或截图，按页序上传。AI
                只读取截图里的文字和数据，用目标风格重新排版，不会混用风格图里的内容。
              </p>
              <PageScreenshotUpload pages={pages} onChange={setPages} />
            </CardContent>
          </Card>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(0)}>
              <ChevronLeft className="h-4 w-4" />
              上一步
            </Button>
            <Button onClick={() => setStep(2)} disabled={pages.length === 0}>
              下一步
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mt-8 space-y-6">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-violet-400" />
                确认并开始焕新
              </CardTitle>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="项目名称（可选）"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-slate-500">目标风格</p>
                  {styleRef && (
                    <div className="mt-2 aspect-video overflow-hidden rounded-lg bg-slate-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={styleRef}
                        alt="风格参考"
                        className="h-full w-full object-contain"
                      />
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-slate-500">
                    原稿 {pages.length} 页
                  </p>
                  <div className="mt-2 grid grid-cols-4 gap-1">
                    {pages.slice(0, 8).map((p, i) => (
                      <div
                        key={p.id}
                        className="relative aspect-video overflow-hidden rounded bg-slate-900"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.url}
                          alt={`第 ${i + 1} 页`}
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute bottom-0 left-0 bg-black/60 px-1 text-[10px] text-white">
                          {i + 1}
                        </span>
                      </div>
                    ))}
                    {pages.length > 8 && (
                      <div className="flex aspect-video items-center justify-center rounded bg-white/5 text-xs text-slate-500">
                        +{pages.length - 8}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <ul className="space-y-1 text-sm text-slate-400">
                <li>· 图1 风格参考：只取配色与设计感，不取任何文字</li>
                <li>· 图2 原稿截图：保留全部文字与数据，重设计排版</li>
                <li>· 输出专业 keynote 级幻灯片，全 deck 风格统一</li>
              </ul>
            </CardContent>
          </Card>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>
              <ChevronLeft className="h-4 w-4" />
              上一步
            </Button>
            <Button onClick={handleGenerate} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              开始焕新 {pages.length} 页
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RemixPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
        </div>
      }
    >
      <RemixWizard />
    </Suspense>
  );
}
