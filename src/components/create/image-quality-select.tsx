"use client";

import { cn } from "@/lib/utils";
import type { ImageQuality } from "@/lib/ai/grsai-config";
import { IMAGE_QUALITY_LABELS } from "@/lib/ai/grsai-config";

type Props = {
  value: ImageQuality;
  onChange: (value: ImageQuality) => void;
  className?: string;
};

export function ImageQualitySelect({ value, onChange, className }: Props) {
  return (
    <div className={className}>
      <label className="text-sm text-slate-400">生成画质</label>
      <div className="mt-2 flex gap-2">
        {(["standard", "hd"] as const).map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onChange(q)}
            className={cn(
              "flex-1 rounded-lg border px-3 py-2.5 text-left text-sm transition",
              value === q
                ? "border-violet-500 bg-violet-600/20 text-violet-200"
                : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20"
            )}
          >
            <span className="font-medium text-white">
              {IMAGE_QUALITY_LABELS[q]}
            </span>
            <span className="mt-0.5 block text-xs opacity-80">
              {q === "standard"
                ? "gpt-image-2 · 默认"
                : "gpt-image-2-vip · 4K"}
            </span>
          </button>
        ))}
      </div>
      {value === "hd" && (
        <p className="mt-2 text-xs text-amber-400/90">
          高清模式消耗更多积分（约 1300/页），仅使用 4K 分辨率。
        </p>
      )}
    </div>
  );
}
