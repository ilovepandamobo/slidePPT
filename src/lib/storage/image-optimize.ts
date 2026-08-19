/** 上传参考图：适度压缩以节省磁盘（AI 参考无需原图 4K PNG） */
export const UPLOAD_REF_TARGET_BYTES = 2 * 1024 * 1024;
export const UPLOAD_REF_MAX_EDGE = 2048;

/** 幻灯片成图：4K JPEG 保留分辨率，避免 PNG 占满磁盘 */
export const SLIDE_TARGET_BYTES = 4 * 1024 * 1024;
export const SLIDE_MAX_EDGE = 3840;

export type OptimizeResult = {
  buffer: Buffer;
  mime: string;
  ext: string;
  optimized: boolean;
  originalBytes: number;
};

export async function optimizeImageBuffer(
  input: Buffer,
  mimeHint?: string,
  options?: { targetBytes?: number; maxEdge?: number; force?: boolean }
): Promise<OptimizeResult> {
  const TARGET_BYTES = options?.targetBytes ?? 8 * 1024 * 1024;
  const MAX_EDGE = options?.maxEdge ?? 3072;
  const originalBytes = input.length;

  if (!options?.force && originalBytes <= TARGET_BYTES) {
    const ext = extFromMime(mimeHint || "image/jpeg");
    return {
      buffer: input,
      mime: mimeHint || "image/jpeg",
      ext,
      optimized: false,
      originalBytes,
    };
  }

  try {
    const sharp = (await import("sharp")).default;
    let quality = 90;
    let buffer = await sharp(input, { animated: false })
      .rotate()
      .resize({
        width: MAX_EDGE,
        height: MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    while (buffer.length > TARGET_BYTES && quality > 60) {
      quality -= 10;
      buffer = await sharp(input)
        .rotate()
        .resize({
          width: MAX_EDGE,
          height: MAX_EDGE,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
    }

    return {
      buffer,
      mime: "image/jpeg",
      ext: "jpg",
      optimized: true,
      originalBytes,
    };
  } catch (e) {
    console.warn("[image-optimize] fallback to original", e);
    const ext = extFromMime(mimeHint || "image/jpeg");
    return {
      buffer: input,
      mime: mimeHint || "image/jpeg",
      ext,
      optimized: false,
      originalBytes,
    };
  }
}

function extFromMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}
