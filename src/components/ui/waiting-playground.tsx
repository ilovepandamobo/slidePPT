"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type WaitingVariant = "outline" | "assist" | "generate";

const TIPS: Record<WaitingVariant, string[]> = {
  outline: [
    "AI 正在读你的大纲，像翻侦探小说一样找页码…",
    "目录里的 1.2.3. 不会变成三页，放心",
    "「配图指引」会留给画师，不会印在幻灯片上",
    "格式再乱也没关系，语义比格式重要",
    "马上就好 — 比手工分页轻松多了",
  ],
  assist: [
    "策划师 AI 正在脑暴封面标题…",
    "好大纲 = 少改十版 PPT",
    "封面、目录、正文、结语 — 经典四件套安排中",
    "正在把你的主题翻译成页级结构…",
  ],
  generate: [
    "像素画师正在调渐变背景…",
    "字体对齐中 — 强迫症模式已开启",
    "4K 模式更慢，但放大不糊",
    "每页都是独立创作，不是复制粘贴",
    "配色参考已锁定，风格不会跑偏",
    "快好了 — 你的幻灯片正在穿礼服",
  ],
};

const TITLES: Record<WaitingVariant, string> = {
  outline: "智能识别大纲中",
  assist: "AI 策划师开工了",
  generate: "幻灯片绘制中",
};

function parseProgressFraction(text: string): number | null {
  const m = text.match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return null;
  const done = Number(m[1]);
  const total = Number(m[2]);
  if (!total || done < 0) return null;
  return Math.min(1, done / total);
}

type WaitingPlaygroundProps = {
  open: boolean;
  variant: WaitingVariant;
  /** 如「已完成 3/12 页」 */
  progress?: string;
  className?: string;
};

export function WaitingPlayground({
  open,
  variant,
  progress,
  className,
}: WaitingPlaygroundProps) {
  const tips = TIPS[variant];
  const [tipIndex, setTipIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [tipVisible, setTipVisible] = useState(true);

  const fraction = useMemo(
    () => (progress ? parseProgressFraction(progress) : null),
    [progress]
  );

  useEffect(() => {
    if (!open) {
      setElapsed(0);
      setTipIndex(0);
      return;
    }
    const tick = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(tick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const rotate = window.setInterval(() => {
      setTipVisible(false);
      window.setTimeout(() => {
        setTipIndex((i) => (i + 1) % tips.length);
        setTipVisible(true);
      }, 280);
    }, 4200);
    return () => window.clearInterval(rotate);
  }, [open, tips.length]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center bg-[#07070f]/85 p-4 backdrop-blur-md",
        className
      )}
      role="dialog"
      aria-modal="true"
      aria-busy="true"
      aria-label={TITLES[variant]}
    >
      <div className="glass-card relative w-full max-w-md overflow-hidden rounded-2xl p-8 shadow-2xl shadow-violet-950/50">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-indigo-500/15 blur-3xl" />

        <div className="relative flex flex-col items-center text-center">
          <SlideDeckAnimation variant={variant} />
          <h2 className="mt-6 text-lg font-semibold text-white">
            {TITLES[variant]}
          </h2>
          {progress ? (
            <p className="mt-2 text-sm text-violet-300">{progress}</p>
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              {variant === "outline"
                ? "通常 10–40 秒，标准格式会更快"
                : variant === "generate"
                  ? "每页独立生成，请稍候"
                  : "灵感加载中…"}
            </p>
          )}

          <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-white/10">
            {fraction != null ? (
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-400 transition-all duration-500 ease-out"
                style={{ width: `${Math.round(fraction * 100)}%` }}
              />
            ) : (
              <div className="waiting-indeterminate h-full w-1/3 rounded-full bg-gradient-to-r from-violet-500 to-indigo-400" />
            )}
          </div>

          <p
            className={cn(
              "mt-6 min-h-[3rem] text-sm leading-relaxed text-slate-400 transition-opacity duration-300",
              tipVisible ? "opacity-100" : "opacity-0"
            )}
          >
            💡 {tips[tipIndex]}
          </p>

          {elapsed >= 3 && (
            <p className="mt-2 text-xs text-slate-600">
              已等待 {elapsed} 秒
              {elapsed >= 25 ? " — 快了快了" : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SlideDeckAnimation({ variant }: { variant: WaitingVariant }) {
  const labels =
    variant === "outline"
      ? ["读", "拆", "OK"]
      : variant === "assist"
        ? ["想", "写", "✦"]
        : ["涂", "修", "✓"];

  return (
    <div className="waiting-deck relative h-28 w-40" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            "waiting-slide absolute inset-x-0 mx-auto h-[4.5rem] w-[7rem] rounded-lg border border-white/15 bg-gradient-to-br shadow-lg",
            i === 0 && "from-violet-600/40 to-indigo-900/60 waiting-slide-a",
            i === 1 && "from-fuchsia-600/30 to-violet-900/50 waiting-slide-b",
            i === 2 && "from-indigo-500/35 to-slate-900/60 waiting-slide-c"
          )}
          style={{ zIndex: 3 - i }}
        >
          <div className="flex h-full flex-col justify-center gap-1 px-3">
            <div className="h-1.5 w-8 rounded-full bg-white/30" />
            <div className="h-1 w-full rounded-full bg-white/15" />
            <div className="h-1 w-2/3 rounded-full bg-white/10" />
            <span className="mt-1 text-[10px] font-medium text-white/50">
              {labels[i]}
            </span>
          </div>
        </div>
      ))}
      <div className="waiting-spark waiting-spark-1 absolute -right-1 top-2 text-sm">
        ✦
      </div>
      <div className="waiting-spark waiting-spark-2 absolute -left-2 bottom-4 text-xs">
        ✧
      </div>
      <div className="waiting-spark waiting-spark-3 absolute right-4 bottom-0 text-[10px]">
        ·
      </div>
    </div>
  );
}
