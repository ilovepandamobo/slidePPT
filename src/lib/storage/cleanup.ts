import { readdir, stat, unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { parseImageHistory } from "@/lib/slide-image-history";

const DATA_ROOT = process.env.DATA_DIR || path.join(process.cwd(), "data");
const SLIDE_DIR = path.join(DATA_ROOT, "slide-images");
const REF_DIR = path.join(DATA_ROOT, "style-refs");

function collectPath(url: string | null | undefined, set: Set<string>) {
  if (!url) return;
  if (url.includes("/api/files/slide-images/")) {
    set.add(path.basename(url.split("?")[0]));
  }
  if (url.includes("/api/files/style-refs/")) {
    set.add(path.basename(url.split("?")[0]));
  }
}

async function dirSize(dir: string): Promise<number> {
  let total = 0;
  try {
    for (const name of await readdir(dir)) {
      const s = await stat(path.join(dir, name));
      if (s.isFile()) total += s.size;
    }
  } catch {
    /* missing */
  }
  return total;
}

export async function runStorageCleanup() {
  const usedSlides = new Set<string>();
  const usedRefs = new Set<string>();

  const projects = await prisma.project.findMany({
    select: { styleReference: true },
  });
  for (const p of projects) collectPath(p.styleReference, usedRefs);

  const slides = await prisma.slide.findMany({
    select: { imageUrl: true, imageHistory: true, layoutReference: true },
  });
  for (const s of slides) {
    collectPath(s.imageUrl, usedSlides);
    collectPath(s.layoutReference, usedRefs);
    for (const h of parseImageHistory(s.imageHistory)) {
      collectPath(h.imageUrl, usedSlides);
    }
  }

  let freed = 0;
  let removed = 0;

  for (const [dir, used] of [
    [SLIDE_DIR, usedSlides],
    [REF_DIR, usedRefs],
  ] as const) {
    let files: string[] = [];
    try {
      files = await readdir(dir);
    } catch {
      continue;
    }
    for (const name of files) {
      if (used.has(name)) continue;
      const fp = path.join(dir, name);
      try {
        const s = await stat(fp);
        if (!s.isFile()) continue;
        await unlink(fp);
        freed += s.size;
        removed++;
      } catch {
        /* skip */
      }
    }
  }

  const slideMb = (await dirSize(SLIDE_DIR)) / 1024 / 1024;
  const refMb = (await dirSize(REF_DIR)) / 1024 / 1024;

  return {
    removed,
    freedMb: Math.round((freed / 1024 / 1024) * 100) / 100,
    remainingSlideMb: Math.round(slideMb * 10) / 10,
    remainingRefMb: Math.round(refMb * 10) / 10,
  };
}
