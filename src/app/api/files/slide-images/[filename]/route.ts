import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import {
  detectImageMime,
  getSlideImageFilePath,
} from "@/lib/storage/slide-image";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  try {
    const filePath = getSlideImageFilePath(filename);
    const buf = await readFile(filePath);
    const type = detectImageMime(buf, filename);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  }
}
