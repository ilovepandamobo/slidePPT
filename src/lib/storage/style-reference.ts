import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { optimizeImageBuffer } from "./image-optimize";

const DATA_ROOT =
  process.env.DATA_DIR || path.join(process.cwd(), "data");
const REF_DIR = path.join(DATA_ROOT, "style-refs");

/** 仅 GrsAI 传输时若超过此大小才静默压缩（用户无感知） */
const GRSAI_SOFT_LIMIT = 12 * 1024 * 1024;

function mimeFromExt(ext: string): string {
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return "image/jpeg";
  }
}

function bufferToDataUrl(buf: Buffer, mime: string): string {
  return `data:${mime};base64,${buf.toString("base64")}`;
}

function extFromMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

/** 原图保存，不压缩、不限制大小（与竞品一致） */
export async function persistStyleReference(
  dataUrl: string
): Promise<{ path: string }> {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    if (dataUrl.startsWith("http") || dataUrl.startsWith("/api/")) {
      return { path: dataUrl };
    }
    throw new Error("无效的参考图格式");
  }

  const mime = match[1];
  const buf = Buffer.from(match[2], "base64");

  const ext = extFromMime(mime);
  const id = randomUUID();
  await mkdir(REF_DIR, { recursive: true });
  const filename = `${id}.${ext}`;
  await writeFile(path.join(REF_DIR, filename), buf);

  return { path: `/api/files/style-refs/${filename}` };
}

async function readLocalStyleRefFile(filename: string): Promise<Buffer> {
  return readFile(getStyleReferenceFilePath(filename));
}

function isNonPublicHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local") ||
    /^192\.168\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}

/**
 * 发给 GrsAI：转 base64；仅当体积过大时后台静默压缩，不阻断用户上传
 */
export async function loadStyleReferenceForGrsai(
  stored: string | null | undefined
): Promise<string[]> {
  if (!stored) return [];

  try {
    let buf: Buffer;
    let mime = "image/jpeg";

    if (stored.startsWith("data:")) {
      const match = stored.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return [];
      mime = match[1];
      buf = Buffer.from(match[2], "base64");
    } else if (
      stored.startsWith("/api/files/slide-images/") ||
      (stored.startsWith("http") &&
        new URL(stored).pathname.includes("/api/files/slide-images/"))
    ) {
      const { readSlideImageBuffer } = await import("./slide-image");
      const filename = path.basename(
        stored.startsWith("http") ? new URL(stored).pathname : stored
      );
      const read = await readSlideImageBuffer(filename);
      buf = read.buf;
      mime = read.mime;
    } else if (
      stored.startsWith("/api/files/style-refs/") ||
      (stored.startsWith("http") &&
        new URL(stored).pathname.includes("/api/files/style-refs/"))
    ) {
      const filename = path.basename(
        stored.startsWith("http") ? new URL(stored).pathname : stored
      );
      buf = await readLocalStyleRefFile(filename);
      mime = mimeFromExt(filename.split(".").pop() || "jpg");
    } else if (stored.startsWith("http://") || stored.startsWith("https://")) {
      const u = new URL(stored);
      if (isNonPublicHost(u.hostname)) return [];
      return [stored];
    } else {
      return [];
    }

    if (buf.length > GRSAI_SOFT_LIMIT) {
      const { buffer, mime: outMime } = await optimizeImageBuffer(buf, mime);
      return [bufferToDataUrl(buffer, outMime)];
    }

    return [bufferToDataUrl(buf, mime)];
  } catch (e) {
    console.error("[style-ref] load for GrsAI failed", e);
    return [];
  }
}

export function resolveStyleReferencePath(stored: string): string {
  if (stored.startsWith("data:") || stored.startsWith("http")) {
    return stored;
  }
  if (stored.startsWith("/api/files/style-refs/")) {
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return `${base.replace(/\/$/, "")}${stored}`;
  }
  return stored;
}

export function getStyleReferenceFilePath(filename: string): string {
  const safe = path.basename(filename);
  return path.join(REF_DIR, safe);
}
