import { jsPDF } from "jspdf";

type SlideExport = {
  imageUrl: string;
};

type PageSpec = {
  widthMm: number;
  heightMm: number;
  orientation: "portrait" | "landscape";
};

/** 页面尺寸与幻灯片画幅一致，避免拉伸 */
function pageSpecFromAspectRatio(aspectRatio: string): PageSpec {
  const longEdge = 297;

  switch (aspectRatio) {
    case "4:3":
      return {
        widthMm: longEdge,
        heightMm: (longEdge * 3) / 4,
        orientation: "landscape",
      };
    case "9:16":
      return {
        widthMm: 108,
        heightMm: 192,
        orientation: "portrait",
      };
    case "16:9":
    default:
      return {
        widthMm: longEdge,
        heightMm: (longEdge * 9) / 16,
        orientation: "landscape",
      };
  }
}

function imageFormatFromUrl(url: string): "PNG" | "JPEG" | "WEBP" {
  if (url.includes("image/jpeg") || url.includes("image/jpg")) return "JPEG";
  if (url.includes("image/webp")) return "WEBP";
  return "PNG";
}

async function getImagePixelSize(
  imageUrl: string
): Promise<{ w: number; h: number } | null> {
  const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  try {
    const sharp = (await import("sharp")).default;
    const buf = Buffer.from(match[2], "base64");
    const meta = await sharp(buf).metadata();
    if (meta.width && meta.height) {
      return { w: meta.width, h: meta.height };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** 在页面内等比居中（contain），防止实际像素比例与画幅略有偏差 */
function fitRect(
  imgW: number,
  imgH: number,
  pageW: number,
  pageH: number
): { x: number; y: number; w: number; h: number } {
  const imgAspect = imgW / imgH;
  const pageAspect = pageW / pageH;

  let w = pageW;
  let h = pageH;
  if (imgAspect > pageAspect) {
    h = pageW / imgAspect;
  } else {
    w = pageH * imgAspect;
  }

  return {
    x: (pageW - w) / 2,
    y: (pageH - h) / 2,
    w,
    h,
  };
}

export async function buildPdf(
  title: string,
  slides: SlideExport[],
  aspectRatio: string
): Promise<Buffer> {
  const page = pageSpecFromAspectRatio(aspectRatio);
  const format: [number, number] = [page.widthMm, page.heightMm];

  const doc = new jsPDF({
    orientation: page.orientation,
    unit: "mm",
    format,
  });

  for (let i = 0; i < slides.length; i++) {
    if (i > 0) doc.addPage(format, page.orientation);

    const imageUrl = slides[i].imageUrl;
    const fmt = imageFormatFromUrl(imageUrl);
    const pixels = await getImagePixelSize(imageUrl);

    const rect = pixels
      ? fitRect(pixels.w, pixels.h, page.widthMm, page.heightMm)
      : { x: 0, y: 0, w: page.widthMm, h: page.heightMm };

    try {
      doc.addImage(imageUrl, fmt, rect.x, rect.y, rect.w, rect.h);
    } catch {
      doc.setFontSize(16);
      doc.text(`Slide ${i + 1}`, 20, 40);
    }
  }

  doc.setProperties({ title });
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
