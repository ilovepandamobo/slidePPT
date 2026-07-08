"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Play,
  Plus,
  Trash2,
  RefreshCw,
  GripVertical,
  Share2,
  History,
  ImagePlus,
  Wand2,
  Copy,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ImageQualitySelect } from "@/components/create/image-quality-select";
import {
  parseImageQuality,
  resolveGrsaiDrawConfig,
  type ImageQuality,
} from "@/lib/ai/grsai-config";

type SlideImageVariant = {
  id: string;
  imageUrl: string;
  createdAt: string;
  label?: string;
};

type Slide = {
  id: string;
  order: number;
  pageType: string;
  title: string;
  content: string;
  notes?: string | null;
  imageUrl?: string | null;
  imageHistory?: string | null;
  status: string;
};

type Project = {
  id: string;
  title: string;
  aspectRatio: string;
  imageQuality?: string | null;
  stylePrompt?: string | null;
  templateId?: string | null;
  slides: Slide[];
};

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deckBusy, setDeckBusy] = useState(false);
  /** 正在生成/重设计的页（可多页并行） */
  const [generatingSlideIds, setGeneratingSlideIds] = useState<Set<string>>(
    () => new Set()
  );
  const [uploadingSlideId, setUploadingSlideId] = useState<string | null>(
    null
  );
  const [genMessage, setGenMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [imageHistory, setImageHistory] = useState<SlideImageVariant[]>([]);
  const [presenting, setPresenting] = useState(false);
  const [deckPrompt, setDeckPrompt] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [showShare, setShowShare] = useState(false);
  /** 已上传、待生成时使用的参考图（按页） */
  const [pendingReferenceUrl, setPendingReferenceUrl] = useState<string | null>(
    null
  );
  /** 重设计时的修改说明（按页，不写入数据库） */
  const [editInstructions, setEditInstructions] = useState<
    Record<string, string>
  >({});
  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`);
    if (res.status === 401) {
      router.push("/login?redirect=/editor/" + id);
      return;
    }
    const data = await res.json();
    if (data.project) setProject(data.project);
    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  const slide = project?.slides[activeIndex];
  const imageQuality = parseImageQuality(project?.imageQuality);
  const drawLabel = project
    ? resolveGrsaiDrawConfig(project.aspectRatio, imageQuality).label
    : "GPT Image 2";

  function isSlideGenerating(s: Slide): boolean {
    return s.status === "generating" || generatingSlideIds.has(s.id);
  }

  const generatingSlides =
    project?.slides
      .map((s, i) => ({ s, index: i }))
      .filter(({ s }) => isSlideGenerating(s)) ?? [];

  const isCurrentSlideGenerating = slide ? isSlideGenerating(slide) : false;
  const isCurrentSlideUploading = uploadingSlideId === slide?.id;
  const anySlideGenerating = generatingSlides.length > 0;

  function markSlideGenerating(slideId: string) {
    setGeneratingSlideIds((prev) => new Set(prev).add(slideId));
  }

  function unmarkSlideGenerating(slideId: string) {
    setGeneratingSlideIds((prev) => {
      const next = new Set(prev);
      next.delete(slideId);
      return next;
    });
  }

  async function saveImageQuality(quality: ImageQuality) {
    if (!project) return;
    setProject({ ...project, imageQuality: quality });
    await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageQuality: quality }),
    });
  }

  useEffect(() => {
    if (!slide?.imageHistory) {
      setImageHistory([]);
      return;
    }
    try {
      const parsed = JSON.parse(slide.imageHistory) as SlideImageVariant[];
      setImageHistory(Array.isArray(parsed) ? parsed : []);
    } catch {
      setImageHistory([]);
    }
  }, [slide?.id, slide?.imageHistory]);

  useEffect(() => {
    setPendingReferenceUrl(null);
  }, [slide?.id]);

  useEffect(() => {
    if (!anySlideGenerating) return;
    const timer = setInterval(() => {
      load();
    }, 4000);
    return () => clearInterval(timer);
  }, [anySlideGenerating, load]);

  async function saveSlide(updates: Partial<Slide> & { regenerate?: boolean }) {
    if (!slide || !project) return;
    const res = await fetch(`/api/projects/${id}/slides/${slide.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (data.slide) {
      setProject((p) =>
        p
          ? {
              ...p,
              slides: p.slides.map((s) =>
                s.id === slide.id ? { ...s, ...data.slide } : s
              ),
            }
          : null
      );
    }
  }

  async function deleteSlide() {
    if (!slide || !project || project.slides.length <= 1) return;
    if (!confirm("确定删除此页？")) return;
    await fetch(`/api/projects/${id}/slides/${slide.id}`, { method: "DELETE" });
    await load();
    setActiveIndex(Math.max(0, activeIndex - 1));
  }

  async function addSlide() {
    setDeckBusy(true);
    await fetch(`/api/projects/${id}/slides`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order: (project?.slides.length || 0),
        title: "新页面",
        content: "• 要点",
      }),
    });
    await load();
    setDeckBusy(false);
    if (project) setActiveIndex(project.slides.length);
  }

  async function duplicateSlide() {
    if (!slide) return;
    await fetch(`/api/projects/${id}/slides`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order: slide.order + 1,
        title: slide.title + " (副本)",
        content: slide.content,
        pageType: slide.pageType,
      }),
    });
    await load();
  }

  async function generateCurrentSlide(referenceUrl?: string | null) {
    if (!slide || !project) return;

    if (!slide.title.trim() && !slide.content.trim()) {
      setActionError("请先填写「标题」或「页面要点」");
      return;
    }
    if (isSlideGenerating(slide)) {
      setActionError("该页正在生成中，请稍候");
      return;
    }

    setActionError(null);
    const targetSlideId = slide.id;
    const title = slide.title;
    const content = slide.content;
    markSlideGenerating(targetSlideId);

    await fetch(`/api/projects/${id}/slides/${targetSlideId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    });

    setProject((p) =>
      p
        ? {
            ...p,
            slides: p.slides.map((s) =>
              s.id === targetSlideId ? { ...s, status: "generating" } : s
            ),
          }
        : null
    );

    try {
      const res = await fetch(`/api/projects/${id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slideIds: [targetSlideId],
          ...(referenceUrl ? { referenceImageUrl: referenceUrl } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "本页生成失败，请稍后重试");
        await load();
        return;
      }
      if (data.project) {
        setProject(data.project);
        const idx = data.project.slides.findIndex(
          (s: Slide) => s.id === targetSlideId
        );
        if (idx >= 0) setActiveIndex(idx);
      } else {
        await load();
      }
      if (referenceUrl) {
        setPendingReferenceUrl(null);
      }
      if (data.partial && data.failures?.length) {
        setActionError(data.failures[0]?.error || "本页生成失败");
      }
    } catch {
      setActionError("网络错误，请检查连接后重试");
      await load();
    } finally {
      unmarkSlideGenerating(targetSlideId);
    }
  }

  async function redesignSlide() {
    if (!slide || !project) return;

    const useReference = Boolean(pendingReferenceUrl);
    const targetSlideId = slide.id;
    const instructions = (editInstructions[targetSlideId] ?? "").trim();
    const title = slide.title;
    const imageUrl = slide.imageUrl;
    const referenceUrl = pendingReferenceUrl;

    if (!instructions) {
      setActionError(
        "请先在「修改说明」里写明要如何改这一页（不会原样贴到幻灯片上）"
      );
      return;
    }
    if (!imageUrl) {
      setActionError("当前页尚无图片，请使用「生成本页」");
      return;
    }
    if (isSlideGenerating(slide)) {
      setActionError("该页正在生成中，请稍候");
      return;
    }

    setActionError(null);
    markSlideGenerating(targetSlideId);

    setProject((p) =>
      p
        ? {
            ...p,
            slides: p.slides.map((s) =>
              s.id === targetSlideId ? { ...s, status: "generating" } : s
            ),
          }
        : null
    );

    try {
      const res = await fetch(
        `/api/projects/${id}/slides/${targetSlideId}/redesign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            editInstructions: instructions,
            ...(useReference && referenceUrl
              ? { referenceImageUrl: referenceUrl }
              : {}),
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "重新设计失败，请稍后重试");
        await load();
        return;
      }
      if (data.slide) {
        setProject((p) =>
          p
            ? {
                ...p,
                slides: p.slides.map((s) =>
                  s.id === targetSlideId ? { ...s, ...data.slide } : s
                ),
              }
            : null
        );
        if (activeIndex === project.slides.findIndex((s) => s.id === targetSlideId)) {
          if (Array.isArray(data.imageHistory)) {
            setImageHistory(data.imageHistory);
          }
        }
      }
      if (useReference) {
        setPendingReferenceUrl(null);
      }
    } catch {
      setActionError("网络错误，请检查连接后重试");
      await load();
    } finally {
      unmarkSlideGenerating(targetSlideId);
    }
  }

  function runPrimarySlideAction() {
    if (!slide) return;
    if (!slide.imageUrl) {
      void generateCurrentSlide(pendingReferenceUrl);
      return;
    }
    void redesignSlide();
  }

  async function activateImageVariant(variantId: string) {
    if (!slide || isCurrentSlideGenerating) return;
    setDeckBusy(true);
    setActionError(null);
    try {
      const res = await fetch(
        `/api/projects/${id}/slides/${slide.id}/activate-image`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variantId }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "切换版本失败");
        return;
      }
      if (data.slide) {
        setProject((p) =>
          p
            ? {
                ...p,
                slides: p.slides.map((s) =>
                  s.id === slide.id ? { ...s, ...data.slide } : s
                ),
              }
            : null
        );
      }
      if (Array.isArray(data.imageHistory)) {
        setImageHistory(data.imageHistory);
      }
    } finally {
      setDeckBusy(false);
    }
  }

  async function regenerateAll() {
    setDeckBusy(true);
    setActionError(null);
    setGenMessage(
      `正在并发生成 ${project?.slides.length ?? 0} 页，请耐心等待…`
    );
    try {
      const res = await fetch(`/api/projects/${id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "批量生成失败");
      }
      if (data.partial && data.failures?.length) {
        const detail = data.failures
          .map(
            (f: { order: number; title: string; error: string }) =>
              `第${f.order}页「${f.title}」`
          )
          .join("、");
        setActionError(`部分页面失败：${detail}。成功的页已更新。`);
      } else {
        setGenMessage(null);
      }
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "批量生成失败");
      await load();
    } finally {
      setDeckBusy(false);
      setGenMessage(null);
    }
  }

  async function exportDeck(format: "pptx" | "pdf") {
    setDeckBusy(true);
    const res = await fetch(`/api/projects/${id}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format }),
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project?.title || "presentation"}.${format}`;
      a.click();
    }
    setDeckBusy(false);
  }

  async function saveVersion() {
    await fetch(`/api/projects/${id}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: `手动保存 ${new Date().toLocaleTimeString()}` }),
    });
    alert("版本已保存");
  }

  async function shareProject() {
    const res = await fetch(`/api/projects/${id}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (data.shareUrl) {
      setShareUrl(data.shareUrl);
      setShowShare(true);
    }
  }

  async function refineDeck() {
    if (!deckPrompt.trim()) {
      setActionError("请先在下方填写全 deck 调整说明");
      return;
    }
    setDeckBusy(true);
    setActionError(null);
    setGenMessage("正在将调整应用到全部页面…");
    try {
      const applyRes = await fetch(`/api/projects/${id}/apply-deck`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: deckPrompt }),
      });
      const applyData = await applyRes.json();
      if (!applyRes.ok) {
        throw new Error(applyData.error || "应用调整失败");
      }
      if (applyData.project) {
        setProject((p) => (p ? { ...p, ...applyData.project } : null));
      }
      setDeckPrompt("");
      setGenMessage(
        `正在按统一说明重生成 ${project?.slides.length ?? 0} 页…`
      );
      const genRes = await fetch(`/api/projects/${id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const genData = await genRes.json();
      if (!genRes.ok) {
        throw new Error(genData.error || "批量生成失败");
      }
      if (genData.partial && genData.failures?.length) {
        setActionError(
          `部分页面生成失败（${genData.failures.length} 页），其余已更新。`
        );
      }
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "全 deck 调整失败");
      await load();
    } finally {
      setDeckBusy(false);
      setGenMessage(null);
    }
  }

  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !slide) return;

    setUploadingSlideId(slide.id);
    setActionError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const upRes = await fetch("/api/upload/slide-image", {
        method: "POST",
        body: fd,
      });
      const upData = await upRes.json();
      if (!upRes.ok) {
        throw new Error(upData.error || "上传失败");
      }
      setPendingReferenceUrl(upData.url);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploadingSlideId((cur) => (cur === slide.id ? null : cur));
    }
  }

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (!project) {
    return <div className="p-10 text-center text-slate-500">项目不存在</div>;
  }

  if (presenting) {
    return (
      <div
        className="fixed inset-0 z-[100] flex flex-col bg-black"
        onClick={() =>
          setActiveIndex((i) =>
            i < project.slides.length - 1 ? i + 1 : i
          )
        }
      >
        <button
          className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white"
          onClick={(e) => {
            e.stopPropagation();
            setPresenting(false);
          }}
        >
          <X />
        </button>
        {slide?.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slide.imageUrl}
            alt=""
            className="h-full w-full object-contain"
          />
        )}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60">
          {activeIndex + 1} / {project.slides.length}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/projects")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            className="h-9 w-48 border-none bg-transparent text-lg font-semibold"
            value={project.title}
            onChange={(e) =>
              setProject({ ...project, title: e.target.value })
            }
            onBlur={async () => {
              await fetch(`/api/projects/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: project.title }),
              });
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={saveVersion}>
            <History className="h-4 w-4" /> 保存版本
          </Button>
          <Button variant="ghost" size="sm" onClick={shareProject}>
            <Share2 className="h-4 w-4" /> 分享
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setPresenting(true)}>
            <Play className="h-4 w-4" /> 放映
          </Button>
          <Button variant="ghost" size="sm" onClick={() => exportDeck("pdf")} disabled={deckBusy}>
            <Download className="h-4 w-4" /> PDF
          </Button>
          <Button size="sm" onClick={() => exportDeck("pptx")} disabled={deckBusy}>
            <Download className="h-4 w-4" /> 导出 PPTX
          </Button>
        </div>
      </div>

      {showShare && shareUrl && (
        <div className="mx-4 mt-2 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400">
          分享链接：{shareUrl}
          <button onClick={() => navigator.clipboard.writeText(shareUrl)} className="underline">
            复制
          </button>
          <button onClick={() => setShowShare(false)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {anySlideGenerating && !isCurrentSlideGenerating && (
        <div className="border-b border-violet-500/30 bg-violet-500/10 px-4 py-2 text-center text-xs text-violet-300">
          {generatingSlides.length === 1
            ? `第 ${generatingSlides[0].index + 1} 页正在后台生成，可继续编辑其他页面`
            : `${generatingSlides.length} 页正在后台生成，可继续编辑其他页面`}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-48 shrink-0 overflow-y-auto border-r border-white/5 bg-black/20 p-2">
          {project.slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={cn(
                "mb-2 w-full overflow-hidden rounded-lg border text-left transition",
                i === activeIndex
                  ? "border-violet-500 ring-1 ring-violet-500"
                  : "border-white/10 hover:border-white/20",
                isSlideGenerating(s) && "border-amber-500/50"
              )}
            >
              <div className="relative aspect-video bg-slate-800">
                {s.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-600">
                    {isSlideGenerating(s) ? "生成中" : "待生成"}
                  </div>
                )}
                {isSlideGenerating(s) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
                  </div>
                )}
              </div>
              <p className="truncate p-1 text-xs text-slate-400">
                {i + 1}. {s.title}
              </p>
            </button>
          ))}
          <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={addSlide}>
            <Plus className="h-4 w-4" /> 添加页面
          </Button>
        </aside>

        <div className="flex flex-1 flex-col items-center justify-center overflow-auto bg-[#0a0a12] p-6">
          <div
            className={cn(
              "relative w-full max-w-4xl overflow-hidden rounded-xl shadow-2xl",
              project.aspectRatio === "9:16" ? "aspect-[9/16] max-w-md" : "aspect-video"
            )}
          >
            {slide?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={slide.imageUrl}
                alt={slide.title}
                className="h-full w-full object-contain bg-black"
              />
            ) : (
              <div className="flex aspect-video items-center justify-center bg-slate-900 text-slate-500">
                {isCurrentSlideGenerating ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  "暂无预览，请生成"
                )}
              </div>
            )}
            {isCurrentSlideGenerating && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-white">
                <Loader2 className="h-10 w-10 animate-spin text-violet-400" />
                <p className="text-sm">
                  {isCurrentSlideUploading
                    ? "正在上传参考图…"
                    : !slide?.imageUrl
                      ? `${drawLabel} 正在生成本页…`
                      : pendingReferenceUrl
                        ? `${drawLabel} 正在按说明生成…`
                        : `${drawLabel} 正在重新设计此页…`}
                </p>
                <p className="text-xs text-white/50">通常需要 30–90 秒，可先切换编辑其他页</p>
              </div>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={activeIndex === 0}
              onClick={() => setActiveIndex((i) => i - 1)}
            >
              <ChevronLeft />
            </Button>
            <span className="flex items-center text-sm text-slate-500">
              {activeIndex + 1} / {project.slides.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={activeIndex >= project.slides.length - 1}
              onClick={() => setActiveIndex((i) => i + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>

        <aside className="w-80 shrink-0 overflow-y-auto border-l border-white/5 bg-black/20 p-4">
          {slide && (
            <div className="space-y-4">
              <h3 className="font-medium text-white">编辑当前页</h3>
              <div>
                <label className="text-xs text-slate-500">标题</label>
                <Input
                  className="mt-1"
                  value={slide.title}
                  onChange={(e) =>
                    setProject((p) =>
                      p
                        ? {
                            ...p,
                            slides: p.slides.map((s, i) =>
                              i === activeIndex
                                ? { ...s, title: e.target.value }
                                : s
                            ),
                          }
                        : null
                    )
                  }
                  onBlur={() => saveSlide({ title: slide.title, content: slide.content })}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">页面要点</label>
                <p className="mt-0.5 text-[11px] text-slate-600">
                  本页大纲/要点，首次生成或全 deck 重生成时使用
                </p>
                <Textarea
                  className="mt-1 min-h-[88px]"
                  placeholder={"例如：• 支持图片、视频、文案生成\n• 模型组合适配不同品类"}
                  value={slide.content}
                  onChange={(e) =>
                    setProject((p) =>
                      p
                        ? {
                            ...p,
                            slides: p.slides.map((s, i) =>
                              i === activeIndex
                                ? { ...s, content: e.target.value }
                                : s
                            ),
                          }
                        : null
                    )
                  }
                  onBlur={() => saveSlide({ title: slide.title, content: slide.content })}
                />
              </div>
              {slide.imageUrl && (
                <div>
                  <label className="text-xs text-slate-500">修改说明</label>
                  <p className="mt-0.5 text-[11px] text-slate-600">
                    告诉 AI 如何改当前页图片；不会把这段话原样画到幻灯片上
                    {pendingReferenceUrl ? "（已上传参考图时，可说明参考图里要借鉴什么）" : ""}
                  </p>
                  <Textarea
                    className="mt-1 min-h-[100px]"
                    placeholder="例如：右侧「优化后的提示词」列表改得更专业、词汇更高级；左侧流程图保留；不要出现本说明文字"
                    value={editInstructions[slide.id] ?? ""}
                    onChange={(e) =>
                      setEditInstructions((prev) => ({
                        ...prev,
                        [slide.id]: e.target.value,
                      }))
                    }
                  />
                </div>
              )}
              <ImageQualitySelect
                value={imageQuality}
                onChange={saveImageQuality}
              />

              {actionError && (
                <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
                  {actionError}
                </p>
              )}

              {imageHistory.length > 0 && (
                <div>
                  <label className="text-xs text-slate-500">图片版本</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isCurrentSlideGenerating}
                      className={cn(
                        "relative h-14 w-24 overflow-hidden rounded-md border-2 transition",
                        "border-violet-500"
                      )}
                      title="当前版本"
                    >
                      {slide.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={slide.imageUrl}
                          alt="当前"
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                      <span className="absolute bottom-0 left-0 right-0 bg-violet-600/90 px-1 text-[10px] text-white">
                        当前
                      </span>
                    </button>
                    {imageHistory.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        disabled={isCurrentSlideGenerating}
                        onClick={() => activateImageVariant(v.id)}
                        className="relative h-14 w-24 overflow-hidden rounded-md border-2 border-white/10 transition hover:border-violet-400"
                        title={v.label || "历史版本"}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={v.imageUrl}
                          alt={v.label || "历史"}
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute bottom-0 left-0 right-0 truncate bg-black/70 px-1 text-[10px] text-white">
                          {v.label || "历史"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {pendingReferenceUrl && (
                <div className="rounded-lg border border-violet-500/40 bg-violet-500/10 p-2">
                  <div className="flex items-start gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pendingReferenceUrl}
                      alt="参考图"
                      className="h-16 w-28 rounded object-cover"
                    />
                    <div className="min-w-0 flex-1 text-xs text-violet-200">
                      <p>已上传参考图</p>
                      <p className="mt-0.5 text-violet-300/80">
                        {slide.imageUrl
                          ? "写好「修改说明」后点下方生成"
                          : "填写「页面要点」后点「按参考图生成本页」"}
                      </p>
                      <button
                        type="button"
                        className="mt-1 text-slate-400 underline hover:text-white"
                        onClick={() => setPendingReferenceUrl(null)}
                      >
                        移除参考图
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  onClick={runPrimarySlideAction}
                  disabled={
                    deckBusy ||
                    isCurrentSlideGenerating ||
                    isCurrentSlideUploading
                  }
                >
                  {isCurrentSlideGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}{" "}
                  {isCurrentSlideGenerating
                    ? "生成中…"
                    : !slide.imageUrl
                      ? pendingReferenceUrl
                        ? "按参考图生成本页"
                        : "生成本页"
                      : pendingReferenceUrl
                        ? "按说明生成新图"
                        : "重新设计此页"}
                </Button>
                <label
                  className={cn(
                    "flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 text-sm hover:bg-white/15",
                    (deckBusy ||
                      isCurrentSlideGenerating ||
                      isCurrentSlideUploading) &&
                      "pointer-events-none opacity-50"
                  )}
                >
                  {isCurrentSlideUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImagePlus className="h-4 w-4" />
                  )}
                  {isCurrentSlideUploading ? "上传中…" : "上传参考图"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={
                      deckBusy ||
                      isCurrentSlideGenerating ||
                      isCurrentSlideUploading
                    }
                    onChange={uploadImage}
                  />
                </label>
                <Button variant="ghost" size="sm" onClick={duplicateSlide}>
                  <Copy className="h-4 w-4" /> 复制页面
                </Button>
                <Button variant="destructive" size="sm" onClick={deleteSlide}>
                  <Trash2 className="h-4 w-4" /> 删除页面
                </Button>
              </div>

              {genMessage && (
                <p className="rounded-lg bg-violet-500/10 px-3 py-2 text-xs text-violet-300">
                  {genMessage}
                </p>
              )}

              <div className="border-t border-white/10 pt-4">
                <h3 className="text-sm font-medium text-white">全 deck 调整</h3>
                <p className="mt-1 text-xs text-slate-500">
                  「重新设计此页」按「修改说明」改当前页图片，不会把说明原样贴到图上。要所有页一起改，请用下方全 deck 说明。
                </p>
                <Textarea
                  className="mt-2 min-h-[80px] text-sm"
                  placeholder="例如：全部改成蓝绿配色、统一减少文字、标题加大…"
                  value={deckPrompt}
                  onChange={(e) => setDeckPrompt(e.target.value)}
                />
                <Button
                  className="mt-2 w-full"
                  variant="secondary"
                  size="sm"
                  onClick={refineDeck}
                  disabled={deckBusy || anySlideGenerating}
                >
                  {deckBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}{" "}
                  应用到全部并重新生成
                </Button>
                <Button
                  className="mt-2 w-full"
                  variant="ghost"
                  size="sm"
                  onClick={regenerateAll}
                  disabled={deckBusy || anySlideGenerating}
                >
                  <RefreshCw className="h-4 w-4" /> 仅全部重生成（不改文案）
                </Button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
