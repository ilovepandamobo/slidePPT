import type { TemplateItem } from "@/types";

type RenderInput = {
  title: string;
  content: string;
  pageType: string;
  pageIndex: number;
  totalPages: number;
  template: TemplateItem;
  stylePrompt?: string;
  watermark?: boolean;
  customImageUrl?: string;
};

function escapeXml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapLines(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  const rawLines = text.split("\n").filter(Boolean);
  for (const line of rawLines) {
    const clean = line.replace(/^[•\-*]\s*/, "").trim();
    if (clean.length <= maxChars) {
      lines.push(clean);
    } else {
      let remaining = clean;
      while (remaining.length > 0) {
        lines.push(remaining.slice(0, maxChars));
        remaining = remaining.slice(maxChars);
      }
    }
  }
  return lines.slice(0, 8);
}

export function renderSlideSvg(input: RenderInput): string {
  const W = 1920;
  const H = 1080;
  const [c1, c2, c3] = input.template.colors;
  const isCover = input.pageType === "cover" || input.pageIndex === 0;
  const isEnding = input.pageType === "ending";
  const isToc = input.pageType === "toc";
  const isSection = input.pageType === "section";
  const isData = input.pageType === "data";

  const bullets = wrapLines(input.content, 42);
  const titleSize = isCover ? 72 : isSection ? 64 : 48;
  const titleY = isCover ? 420 : isSection ? 480 : 120;

  let decor = "";
  if (input.template.id === "aurora-tech") {
    decor = `<ellipse cx="1600" cy="200" rx="400" ry="300" fill="${c2}" opacity="0.15"/>
      <ellipse cx="300" cy="800" rx="350" ry="250" fill="${c3}" opacity="0.1"/>`;
  } else if (input.template.id === "minimal-light") {
    decor = `<rect x="80" y="80" width="4" height="200" fill="${c3}"/>`;
  } else {
    decor = `<rect x="0" y="0" width="${W}" height="8" fill="${c2}"/>
      <circle cx="${W - 100}" cy="100" r="60" fill="${c2}" opacity="0.2"/>`;
  }

  let bodyContent = "";
  if (isCover) {
    bodyContent = `
      <text x="120" y="${titleY}" font-family="system-ui,sans-serif" font-size="${titleSize}" font-weight="700" fill="${c2 === '#fafaf9' || c2 === '#ffffff' || c2 === '#f8fafc' ? c2 : c3}">${escapeXml(input.title)}</text>
      <text x="120" y="${titleY + 80}" font-family="system-ui,sans-serif" font-size="32" fill="${c2}" opacity="0.8">${escapeXml(input.content.split("\n")[0] || "")}</text>
    `;
  } else if (isToc) {
    bullets.forEach((b, i) => {
      bodyContent += `<text x="200" y="${280 + i * 70}" font-family="system-ui" font-size="36" fill="${c2 === '#ffffff' || c2 === '#f8fafc' ? c2 : c3}">${i + 1}. ${escapeXml(b)}</text>`;
    });
  } else if (isSection) {
    bodyContent = `
      <text x="960" y="500" text-anchor="middle" font-family="system-ui" font-size="${titleSize}" font-weight="700" fill="${c2 === '#ffffff' ? c2 : c3}">${escapeXml(input.title)}</text>
    `;
  } else if (isData) {
    bodyContent = `
      <rect x="120" y="200" width="800" height="500" rx="16" fill="${c2}" opacity="0.1" stroke="${c2}" stroke-width="2"/>
      <text x="140" y="180" font-family="system-ui" font-size="40" font-weight="600" fill="${c3}">${escapeXml(input.title)}</text>
      ${bullets.map((b, i) => `<text x="160" y="${280 + i * 55}" font-family="system-ui" font-size="28" fill="${c2 === '#f8fafc' ? c2 : '#334155'}">${escapeXml(b)}</text>`).join("")}
      <rect x="1000" y="250" width="700" height="400" rx="12" fill="${c2}" opacity="0.2"/>
      <text x="1350" y="470" text-anchor="middle" font-family="system-ui" font-size="24" fill="${c2}" opacity="0.6">📊 数据图表区域</text>
    `;
  } else {
    bodyContent = `
      <text x="120" y="${titleY}" font-family="system-ui,sans-serif" font-size="${titleSize}" font-weight="700" fill="${c3}">${escapeXml(input.title)}</text>
      ${bullets.map((b, i) => `<text x="140" y="${220 + i * 65}" font-family="system-ui" font-size="30" fill="${c1 === '#fafaf9' || c1 === '#ffffff' || c1 === '#fff7ed' ? '#334155' : c2}">• ${escapeXml(b)}</text>`).join("")}
    `;
  }

  const watermark = input.watermark
    ? `<text x="1820" y="1060" text-anchor="end" font-family="system-ui" font-size="18" fill="${c2}" opacity="0.35">SlideCraft AI</text>`
    : "";

  const pageNum = `<text x="1820" y="60" text-anchor="end" font-family="system-ui" font-size="20" fill="${c2}" opacity="0.5">${input.pageIndex + 1} / ${input.totalPages}</text>`;

  const bgImage = input.customImageUrl
    ? `<image href="${input.customImageUrl}" x="900" y="180" width="900" height="700" preserveAspectRatio="xMidYMid slice" opacity="0.9"/>`
    : "";

  const bg =
    input.template.preview.includes("gradient") || true
      ? `<defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${c1}"/>
          <stop offset="100%" style="stop-color:${c3 || c1}"/>
        </linearGradient></defs>
        <rect width="${W}" height="${H}" fill="url(#bg)"/>`
      : `<rect width="${W}" height="${H}" fill="${c1}"/>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${bg}
  ${decor}
  ${bgImage}
  ${bodyContent}
  ${pageNum}
  ${watermark}
</svg>`;
}

export function svgToDataUrl(svg: string): string {
  const encoded = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${encoded}`;
}
