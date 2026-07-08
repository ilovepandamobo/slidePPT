/** 仅在调用 GrsAI 且图片过大时后台使用，用户上传阶段不调用 */

const TARGET_BYTES = 8 * 1024 * 1024;
const MAX_EDGE = 3072;

export type OptimizeResult = {
  buffer: Buffer;
  mime: string;
  ext: string;
  optimized: boolean;
  originalBytes: number;
};

export async function optimizeImageBuffer(
  input: Buffer,
  mimeHint?: string
): Promise<OptimizeResult> {
  const originalBytes = input.length;

  if (originalBytes <= TARGET_BYTES) {
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
          width: 2560,
          height: 2560,
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
