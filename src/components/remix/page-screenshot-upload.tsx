"use client";

import { useCallback, useRef, useState } from "react";
import {
  Upload,
  X,
  Loader2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { mapWithConcurrency } from "@/lib/generation-concurrency";
import type { RemixPageUpload } from "@/types";

type Props = {
  pages: RemixPageUpload[];
  onChange: (pages: RemixPageUpload[]) => void;
  className?: string;
};

function sortByName(a: File, b: File): number {
  return a.name.localeCompare(b.name, undefined, { numeric: true });
}

export function PageScreenshotUpload({ pages, onChange, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      const list = Array.from(files)
        .filter((f) => f.type.startsWith("image/"))
        .sort(sortByName);

      if (list.length === 0) {
        setError("请上传 PNG / JPG / WebP 图片");
        return;
      }

      setUploading(true);

      try {
        const added = await mapWithConcurrency(list, 6, async (file) => {
          const fd = new FormData();
          fd.append("file", file);
          const res = await fetch("/api/upload/slide-image", {
            method: "POST",
            body: fd,
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "上传失败");
          return {
            id: crypto.randomUUID(),
            url: data.url as string,
            name: file.name,
          };
        });
        onChange([...pages, ...added]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "上传失败");
      } finally {
        setUploading(false);
      }
    },
    [onChange, pages]
  );

  const removePage = (id: string) => {
    onChange(pages.filter((p) => p.id !== id));
  };

  const movePage = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= pages.length) return;
    const copy = [...pages];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    onChange(copy);
  };

  const onDropReorder = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) return;
    const copy = [...pages];
    const [item] = copy.splice(dragIndex, 1);
    copy.splice(targetIndex, 0, item);
    onChange(copy);
    setDragIndex(null);
  };

  return (
    <div className={cn("space-y-4", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) void uploadFiles(e.target.files);
          e.target.value = "";
        }}
        aria-label="上传 PPT 原稿截图"
      />

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) {
            void uploadFiles(e.dataTransfer.files);
          }
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition",
          dragOver
            ? "border-violet-500 bg-violet-500/10"
            : "border-white/20 hover:border-violet-500/50 hover:bg-white/5",
          uploading && "pointer-events-none opacity-60"
        )}
      >
        {uploading ? (
          <Loader2 className="h-10 w-10 animate-spin text-violet-400" />
        ) : (
          <Upload className="h-10 w-10 text-violet-400" />
        )}
        <p className="mt-3 text-sm font-medium text-white">
          {uploading ? "上传中…" : "点击或拖拽上传原稿截图（可多选）"}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          按文件名数字顺序自动排序 · 支持 PNG / JPG / WebP
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {pages.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">
              已上传 {pages.length} 页 · 拖动或使用箭头调整顺序
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-slate-400"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              继续添加
            </Button>
          </div>

          <ul className="space-y-2">
            {pages.map((page, index) => (
              <li
                key={page.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDropReorder(index)}
                onDragEnd={() => setDragIndex(null)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2",
                  dragIndex === index && "opacity-50"
                )}
              >
                <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-600" />
                <span className="w-8 shrink-0 text-center text-sm font-medium text-violet-400">
                  {index + 1}
                </span>
                <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-slate-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={page.url}
                    alt={`第 ${index + 1} 页`}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white">{page.name}</p>
                  <p className="flex items-center gap-1 text-xs text-slate-500">
                    <ImageIcon className="h-3 w-3" />
                    原稿第 {index + 1} 页
                  </p>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-slate-400"
                    onClick={() => movePage(index, -1)}
                    disabled={index === 0}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-slate-400"
                    onClick={() => movePage(index, 1)}
                    disabled={index === pages.length - 1}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                    onClick={() => removePage(page.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
