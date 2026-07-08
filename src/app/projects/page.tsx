"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Presentation, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type ProjectItem = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  _count: { slides: number };
  slides: { imageUrl?: string | null }[];
};

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => {
        if (r.status === 401) {
          router.push("/login?redirect=/projects");
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (d?.projects) setProjects(d.projects);
        setLoading(false);
      });
  }, [router]);

  async function deleteProject(pid: string) {
    if (!confirm("确定删除？")) return;
    await fetch(`/api/projects/${pid}`, { method: "DELETE" });
    setProjects((p) => p.filter((x) => x.id !== pid));
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">我的项目</h1>
          <p className="mt-1 text-slate-500">{projects.length} 个演示文稿</p>
        </div>
        <Link href="/create">
          <Button>
            <Plus className="h-4 w-4" /> 新建项目
          </Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <Card className="mt-12 p-12 text-center">
          <Presentation className="mx-auto h-12 w-12 text-slate-600" />
          <p className="mt-4 text-slate-500">还没有项目，开始创作吧</p>
          <Link href="/create" className="mt-4 inline-block">
            <Button>创建第一个 PPT</Button>
          </Link>
        </Card>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Card key={p.id} className="group overflow-hidden">
              <Link href={`/editor/${p.id}`}>
                <div className="aspect-video bg-slate-800">
                  {p.slides[0]?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.slides[0].imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-600">
                      <Presentation className="h-10 w-10" />
                    </div>
                  )}
                </div>
              </Link>
              <CardContent className="flex items-start justify-between p-4">
                <div>
                  <Link href={`/editor/${p.id}`}>
                    <h3 className="font-medium text-white hover:text-violet-300">
                      {p.title}
                    </h3>
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">
                    {p._count.slides} 页 · {p.status} ·{" "}
                    {new Date(p.updatedAt).toLocaleDateString("zh-CN")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteProject(p.id)}
                  className="text-slate-600 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
