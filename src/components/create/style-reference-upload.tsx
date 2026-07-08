"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, X, ImageIcon, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  /** 存路径 /api/files/style-refs/xxx，不塞整图 base64 */
  value: string | null;
  onChange: (storedPath: string | null, fileName?: string) => void;
  className?: string;
};

export function StyleReferenceUpload({ value, onChange, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const previewUrl = value
    ? value.startsWith("/api/")
      ? value
      : value
    : null;

  const processFile = useCallback(
    async (file: File) => {
      setError(null);
      if (!file.type.startsWith("image/")) {
        setError("请上传图片文件");
        return;
      }

      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload/style-reference", {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "上传失败");

        onChange(data.path, data.fileName || file.name);
        setFileName(data.fileName || file.name);
      } catch (e) {
        setError(e instanceof Error ? e.message : "上传失败");
      } finally {
        setUploading(false);
      }
    },
    [onChange]
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void processFile(file);
  };

  const clear = () => {
    onChange(null);
    setFileName(null);
    setError(null);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        className="sr-only"
        onChange={onFileChange}
        aria-label="上传参考风格图片"
      />

      {previewUrl ? (
        <div className="overflow-hidden rounded-2xl border border-violet-500/40 bg-black/30">
          <div className="flex items-center justify-between border-b border-white/10 bg-violet-500/10 px-4 py-2">
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <ImageIcon className="h-4 w-4" />
              <span>参考风格已上传</span>
              {fileName && (
                <span className="max-w-[200px] truncate text-slate-500">
                  {fileName}
                </span>
              )}
            </div>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-slate-400"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                更换
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-red-400 hover:text-red-300"
                onClick={clear}
              >
                <X className="h-3.5 w-3.5" />
                移除
              </Button>
            </div>
          </div>
          <div className="relative aspect-video w-full bg-slate-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="参考风格预览"
              className="h-full w-full object-contain"
            />
          </div>
          <p className="px-4 py-2 text-xs text-slate-500">
            原图保存，无大小限制；仅提取色系与设计风格，每页按大纲单独排版
          </p>
        </div>
      ) : (
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
          onDrop={onDrop}
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
            {uploading ? "上传中…" : "点击或拖拽上传参考图"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            PNG / JPG / WebP / GIF，与原图一致保存
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

export function StyleReferenceThumb({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  const url = src.startsWith("/api/") ? src : src;
  return (
    <div
      className={cn(
        "relative h-14 w-24 shrink-0 overflow-hidden rounded-lg border border-white/15",
        className
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="h-full w-full object-cover" />
    </div>
  );
}
