import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const DATA_ROOT =
  process.env.DATA_DIR || path.join(process.cwd(), "data");
const SLIDE_DIR = path.join(DATA_ROOT, "slide-images");

function extFromMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("svg")) return "svg";
  return "jpg";
}

function mimeFromExt(ext: string): string {
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    default:
      return "image/jpeg";
  }
}

/** 按文件头识别真实类型（修正误标 .jpg 的 svg 等） */
export function detectImageMime(buf: Buffer, filename?: string): string {
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF") return "image/webp";
  const head = buf.slice(0, 256).toString("utf8").trimStart();
  if (head.startsWith("<?xml") || head.startsWith("<svg")) return "image/svg+xml";
  const ext = filename?.split(".").pop()?.toLowerCase();
  if (ext) return mimeFromExt(ext);
  return "image/jpeg";
}

export function getSlideImageFilePath(filename: string): string {
  return path.join(SLIDE_DIR, path.basename(filename));
}

/** 将远程 URL 或 data URL 存盘，返回短路径（避免 SQLite 存巨型 base64） */
export async function persistSlideImage(source: string): Promise<string> {
  if (source.startsWith("/api/files/slide-images/")) {
    return source;
  }

  let buf: Buffer;
  let mime = "image/png";

  if (source.startsWith("data:")) {
    const match = source.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error("无效的幻灯片图片格式");
    mime = match[1];
    buf = Buffer.from(match[2], "base64");
  } else if (source.startsWith("http://") || source.startsWith("https://")) {
    const res = await fetch(source, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error(`下载图片失败: ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
    mime = res.headers.get("content-type") || "image/png";
  } else {
    return source;
  }

  const detected = detectImageMime(buf);
  if (detected !== mime) {
    mime = detected;
  }

  await mkdir(SLIDE_DIR, { recursive: true });
  const ext = extFromMime(mime);
  const filename = `${randomUUID()}.${ext}`;
  await writeFile(getSlideImageFilePath(filename), buf);
  return `/api/files/slide-images/${filename}`;
}

export async function ensureStoredImageUrl(
  url: string | null | undefined
): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("/api/files/slide-images/")) return url;
  if (
    url.startsWith("data:") ||
    url.startsWith("http://") ||
    url.startsWith("https://")
  ) {
    try {
      return await persistSlideImage(url);
    } catch (e) {
      console.warn("[slide-image] persist failed, keeping url", e);
      return url.length > 500_000 ? null : url;
    }
  }
  return url;
}

export async function readSlideImageBuffer(filename: string): Promise<{
  buf: Buffer;
  mime: string;
}> {
  const buf = await readFile(getSlideImageFilePath(filename));
  const ext = filename.split(".").pop() || "jpg";
  return { buf, mime: mimeFromExt(ext) };
}

/** 导出 PPTX/PDF 时把本地路径转成 data URL */
export async function resolveImageForExport(url: string): Promise<string> {
  if (!url.startsWith("/api/files/slide-images/")) return url;
  const filename = path.basename(url);
  const { buf, mime } = await readSlideImageBuffer(filename);
  return `data:${mime};base64,${buf.toString("base64")}`;
}
