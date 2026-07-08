"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const [project, setProject] = useState<{
    title: string;
    slides: { imageUrl?: string | null; title: string }[];
  } | null>(null);
  const [index, setIndex] = useState(0);
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [error, setError] = useState("");

  async function load(pwd?: string) {
    const url = `/api/share/${token}${pwd ? `?password=${encodeURIComponent(pwd)}` : ""}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.requiresPassword) {
      setNeedsPassword(true);
      return;
    }
    if (!res.ok) {
      setError(data.error || "无法加载");
      return;
    }
    setProject(data.project);
    setNeedsPassword(false);
  }

  useEffect(() => {
    load();
  }, [token]);

  if (needsPassword) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center px-4">
        <h1 className="text-xl font-bold text-white">输入分享密码</h1>
        <Input
          className="mt-4"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button className="mt-4" onClick={() => load(password)}>
          查看
        </Button>
      </div>
    );
  }

  if (error) {
    return <div className="p-10 text-center text-red-400">{error}</div>;
  }

  if (!project) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  const slide = project.slides[index];

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      <div className="border-b border-white/5 px-4 py-3 text-center">
        <h1 className="font-medium text-white">{project.title}</h1>
        <p className="text-xs text-slate-500">SlideCraft 分享预览</p>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center p-4">
        {slide?.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slide.imageUrl}
            alt={slide.title}
            className="max-h-[70vh] max-w-full rounded-xl shadow-2xl"
          />
        )}
        <div className="mt-6 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            disabled={index === 0}
            onClick={() => setIndex((i) => i - 1)}
          >
            <ChevronLeft />
          </Button>
          <span className="text-sm text-slate-400">
            {index + 1} / {project.slides.length}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={index >= project.slides.length - 1}
            onClick={() => setIndex((i) => i + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
