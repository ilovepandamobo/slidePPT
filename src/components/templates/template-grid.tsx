"use client";

import * as React from "react";
import Link from "next/link";
import { Crown } from "lucide-react";
import type { TemplateItem } from "@/types";
import { cn } from "@/lib/utils";

const CATEGORIES = ["全部", "商务", "科技", "教育", "极简", "活泼"];

export function TemplateGrid({
  templates,
  selectedId,
  onSelect,
  mode = "browse",
}: {
  templates: TemplateItem[];
  selectedId?: string;
  onSelect?: (t: TemplateItem) => void;
  mode?: "browse" | "select";
}) {
  const [category, setCategory] = React.useState("全部");
  const filtered =
    category === "全部"
      ? templates
      : templates.filter((t) => t.category === category);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm transition",
              category === c
                ? "bg-violet-600 text-white"
                : "bg-white/5 text-slate-400 hover:text-white"
            )}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((t) => {
          const inner = (
            <>
              <div className="relative aspect-video" style={{ background: t.preview }}>
                {t.isPremium && (
                  <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-xs text-black">
                    <Crown className="h-3 w-3" /> Pro
                  </span>
                )}
                {selectedId === t.id && (
                  <div className="absolute inset-0 ring-2 ring-violet-500 ring-offset-2 ring-offset-[#07070f]" />
                )}
              </div>
              <div className="p-4">
                <h3 className="font-medium text-white">{t.name}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{t.description}</p>
                <div className="mt-2 flex gap-1">
                  {t.colors.map((c) => (
                    <span
                      key={c}
                      className="h-4 w-4 rounded-full border border-white/20"
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
            </>
          );

          if (mode === "select" && onSelect) {
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelect(t)}
                className={cn(
                  "overflow-hidden rounded-2xl border text-left transition",
                  selectedId === t.id
                    ? "border-violet-500 bg-violet-500/10"
                    : "border-white/10 hover:border-white/20"
                )}
              >
                {inner}
              </button>
            );
          }

          return (
            <Link
              key={t.id}
              href={`/create?style=${t.id}`}
              className="overflow-hidden rounded-2xl border border-white/10 transition hover:border-violet-500/30"
            >
              {inner}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
