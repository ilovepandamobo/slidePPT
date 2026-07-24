"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Loader2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { TemplateGrid } from "@/components/templates/template-grid";
import {
  StyleReferenceUpload,
  StyleReferenceThumb,
} from "@/components/create/style-reference-upload";
import { TEMPLATES, getTemplateById } from "@/lib/templates-data";
import {
  OUTLINE_EXAMPLES,
  parseOutline,
  inferPresentationTitle,
  hasExplicitPageMarkers,
} from "@/lib/outline";
import type { TemplateItem, OutlinePage } from "@/types";
import { cn } from "@/lib/utils";
import { ImageQualitySelect } from "@/components/create/image-quality-select";
import type { ImageQuality } from "@/lib/ai/grsai-config";
import { resolveGrsaiDrawConfig } from "@/lib/ai/grsai-config";
import {
  generateSlidesParallel,
  summarizeParallelFailures,
} from "@/lib/client-generate-slides";

const STEPS = ["选择风格", "编辑大纲", "确认生成"];

function CreateWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [template, setTemplate] = useState<TemplateItem | null>(null);
  const [stylePrompt, setStylePrompt] = useState("");
  const [styleRef, setStyleRef] = useState<string | null>(null);
  const [styleRefName, setStyleRefName] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [outline, setOutline] = useState("");
  const [pages, setPages] = useState<OutlinePage[]>([]);
  const [audience, setAudience] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [imageQuality, setImageQuality] = useState<ImageQuality>("standard");
  const [anchorFirst, setAnchorFirst] = useState(false);
  const [topic, setTopic] = useState("");
  const [genProgress, setGenProgress] = useState("");

  useEffect(() => {
    const styleId = searchParams.get("style");
    if (styleId) {
      const t = getTemplateById(styleId);
      if (t) setTemplate(t);
    }
  }, [searchParams]);

  async function suggestOutline() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/outline/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outline,
          autoSplit: !hasExplicitPageMarkers(outline),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPages(data.pages);
      if (data.suggestedTitle && !title.trim()) {
        setTitle(data.suggestedTitle);
      }
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "解析失败");
    } finally {
      setLoading(false);
    }
  }

  async function assistOutline() {
    if (!topic.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/outline/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, audience }),
      });
      const data = await res.json();
      if (res.ok) setOutline(data.outline);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    setLoading(true);
    setError("");
    let projectId: string | null = null;
    try {
      const meRes = await fetch("/api/auth/me");
      const me = await meRes.json();
      if (!me.user) {
        router.push("/login?redirect=/create");
        return;
      }

      const payload: Record<string, unknown> = {
        title:
          title.trim() ||
          inferPresentationTitle(pages, outline) ||
          "我的演示文稿",
        outlineRaw: outline,
        aspectRatio,
        imageQuality,
        audience: audience || undefined,
        pages: pages.length ? pages : undefined,
      };
      if (template?.id) payload.templateId = template.id;
      if (styleRef) payload.styleReference = styleRef;
      const sp = stylePrompt.trim();
      if (sp) payload.stylePrompt = sp;
      else if (!styleRef && template?.stylePrompt)
        payload.stylePrompt = template.stylePrompt;

      const createRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        throw new Error(createData.error || "创建项目失败");
      }

      projectId = createData.project.id as string;
      let slides: { id: string }[] = createData.project.slides || [];
      if (anchorFirst && slides.length > 1) {
        slides = [slides[0]];
      }

      const drawLabel = resolveGrsaiDrawConfig(aspectRatio, imageQuality).label;
      const pageCount = slides.length;
      const slideIds = slides.map((s) => s.id);

      if (anchorFirst) {
        setGenProgress(`${drawLabel} 正在生成封面…`);
        const genRes = await fetch(`/api/projects/${projectId}/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slideIds: [slideIds[0]] }),
        });
        const genData = await genRes.json();
        if (!genRes.ok) throw new Error(genData.error || "生成失败");
      } else {
        setGenProgress(
          `${drawLabel} 正在并发生成 ${pageCount} 页（每页独立请求）…`
        );
        const { failures } = await generateSlidesParallel(projectId, slideIds, {
          onProgress: (done, total) =>
            setGenProgress(`${drawLabel} 已完成 ${done}/${total} 页…`),
        });
        const summary = summarizeParallelFailures(failures, pageCount);
        if (summary) setError(summary);
      }

      router.push(`/editor/${projectId}`);
    } catch (e) {
      if (projectId) {
        router.push(`/editor/${projectId}`);
        setError(
          `${e instanceof Error ? e.message : "生成异常"}。项目已创建，请到编辑器查看是否已有部分页面完成。`
        );
      } else {
        setError(e instanceof Error ? e.message : "生成失败");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-white">创建演示文稿</h1>

      <div className="mt-8 flex gap-2">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={cn(
              "flex flex-1 items-center gap-2 rounded-xl px-4 py-3 text-sm",
              i === step
                ? "bg-violet-600/20 text-violet-300 border border-violet-500/30"
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
        <div className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {step === 0 && (
        <div className="mt-8 space-y-6">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <CardTitle>选择模版或上传参考风格</CardTitle>
              <TemplateGrid
                templates={TEMPLATES}
                selectedId={template?.id}
                onSelect={setTemplate}
                mode="select"
              />
              <div className="border-t border-white/10 pt-4">
                <p className="mb-1 text-sm font-medium text-white">上传参考风格图</p>
                <p className="mb-3 text-xs text-slate-500">
                  原图上传，无大小限制；只提取色系与风格，每页按大纲单独排版
                </p>
                <StyleReferenceUpload
                  value={styleRef}
                  onChange={(url, name) => {
                    setStyleRef(url);
                    setStyleRefName(name || null);
                  }}
                />
              </div>
              <div>
                <label className="text-sm text-slate-400">风格描述（可选）</label>
                <Textarea
                  className="mt-2"
                  placeholder="例如：麦肯锡风、留白多、蓝灰配色..."
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
          <div className="flex justify-end">
            <Button
              onClick={() => setStep(1)}
              disabled={!template && !styleRef && !stylePrompt.trim()}
            >
              下一步 <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="mt-8 space-y-6">
          {(styleRef || template) && (
            <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
              {styleRef && <StyleReferenceThumb src={styleRef} />}
              <div className="min-w-0 text-sm">
                <p className="text-slate-400">当前风格</p>
                <p className="truncate text-white">
                  {styleRefName
                    ? `参考图：${styleRefName}`
                    : template
                      ? `模版：${template.name}`
                      : "未选择"}
                </p>
                {template && styleRef && (
                  <p className="text-xs text-slate-500">
                    模版 {template.name} + 参考图叠加
                  </p>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setStep(0)}>
                修改
              </Button>
            </div>
          )}
          <Card>
            <CardContent className="space-y-4 pt-6">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="演示文稿标题"
              />
              <div className="flex gap-2">
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="AI 大纲助手：输入主题..."
                />
                <Button variant="secondary" onClick={assistOutline} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  生成大纲
                </Button>
              </div>
              <Input
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="受众（可选）：投资人 / 学生 / 客户..."
              />
              <div className="flex flex-wrap gap-2">
                {OUTLINE_EXAMPLES.map((ex) => (
                  <button
                    key={ex.name}
                    type="button"
                    onClick={() => setOutline(ex.outline)}
                    className="rounded-lg bg-white/5 px-3 py-1 text-xs text-slate-400 hover:text-white"
                  >
                    {ex.name}
                  </button>
                ))}
              </div>
              <Textarea
                className="min-h-[320px] font-mono text-sm"
                value={outline}
                onChange={(e) => {
                  const v = e.target.value;
                  setOutline(v);
                  if (v.trim()) {
                    const preview = parseOutline(v);
                    if (preview.length > 0 && !title.trim()) {
                      setTitle(inferPresentationTitle(preview, v));
                    }
                  }
                }}
                placeholder={`支持多种页码写法（每页一行开头）：
第1页：封面  /  第 1 页：封面  /  第1页封面  /  第一页 封面
Page 1: Cover  /  【第1页】封面

第1页：封面
核心内容 / 内容 / 标题：
●主标题：你的产品名
画面 / 配图指引：
●背景与视觉说明

第2页：目录
核心内容
1.第一章节
2.第二章节`}
              />
              {outline.trim() && (
                <p className="text-xs text-violet-400">
                  已识别 {parseOutline(outline).length} 页
                  {hasExplicitPageMarkers(outline)
                    ? "（严格按页码标记分页，不会拆成续页）"
                    : "（可点「确认大纲」预览分页）"}
                </p>
              )}
            </CardContent>
          </Card>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(0)}>
              <ChevronLeft className="h-4 w-4" /> 上一步
            </Button>
            <Button onClick={suggestOutline} disabled={loading || !outline.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              确认大纲
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mt-8 space-y-6">
          {(styleRef || template) && (
            <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
              {styleRef && <StyleReferenceThumb src={styleRef} className="h-16 w-28" />}
              <div className="text-sm">
                <p className="text-slate-500">风格参考</p>
                <p className="text-white">
                  {template?.name}
                  {template && styleRef ? " + " : ""}
                  {styleRef ? styleRefName || "自定义参考图" : ""}
                </p>
              </div>
            </div>
          )}
          <Card>
            <CardContent className="pt-6">
              <p className="text-slate-400">
                预计 <strong className="text-white">{pages.length}</strong> 页
              </p>
              <ul className="mt-4 max-h-[400px] space-y-2 overflow-y-auto">
                {pages.map((p, i) => (
                  <li
                    key={i}
                    className="flex gap-3 rounded-xl bg-white/5 p-3 text-sm"
                  >
                    <span className="shrink-0 text-violet-400">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs text-slate-500">[{p.pageType}] {p.title}</span>
                      <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap text-slate-300">
                        {p.content}
                      </p>
                      {p.notes && (
                        <p className="mt-1 text-xs text-slate-600 line-clamp-2">🎨 {p.notes}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <ImageQualitySelect
                className="mt-4"
                value={imageQuality}
                onChange={setImageQuality}
              />
              <label className="mt-4 flex items-center gap-2 text-sm text-slate-400">
                <input
                  type="checkbox"
                  checked={anchorFirst}
                  onChange={(e) => setAnchorFirst(e.target.checked)}
                />
                风格锚点：先生成封面，满意后再生成其余
              </label>
            </CardContent>
          </Card>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>
              <ChevronLeft className="h-4 w-4" /> 修改大纲
            </Button>
            <Button onClick={handleGenerate} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {genProgress || "生成中..."}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  开始生成全部页面
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-slate-500">加载中...</div>}>
      <CreateWizard />
    </Suspense>
  );
}
