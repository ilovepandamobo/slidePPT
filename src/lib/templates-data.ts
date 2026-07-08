import type { TemplateItem } from "@/types";

export const TEMPLATES: TemplateItem[] = [
  {
    id: "midnight-pro",
    name: "午夜专业",
    category: "商务",
    description: "深色背景、高对比排版，适合融资路演与高管汇报",
    stylePrompt:
      "Professional McKinsey-style presentation, dark navy background #0f172a, white typography, minimal gold accents, generous whitespace, corporate elegance",
    colors: ["#0f172a", "#f8fafc", "#c9a227"],
    preview: "linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#0f172a 100%)",
    isPremium: false,
  },
  {
    id: "aurora-tech",
    name: "极光科技",
    category: "科技",
    description: "渐变光效与科技感线条，适合产品发布与 AI 主题",
    stylePrompt:
      "Futuristic tech keynote, deep purple to cyan gradient, glassmorphism cards, neon accent lines, clean sans-serif, startup aesthetic",
    colors: ["#4c1d95", "#06b6d4", "#e0e7ff"],
    preview: "linear-gradient(135deg,#4c1d95 0%,#2563eb 50%,#06b6d4 100%)",
    isPremium: false,
  },
  {
    id: "minimal-light",
    name: "极简留白",
    category: "极简",
    description: "大面积留白、克制配色，适合高端品牌与设计方案",
    stylePrompt:
      "Ultra-minimal Scandinavian design, off-white background, black text, single accent color terracotta, asymmetric layout, editorial magazine feel",
    colors: ["#fafaf9", "#1c1917", "#c2410c"],
    preview: "linear-gradient(180deg,#fafaf9 0%,#f5f5f4 100%)",
    isPremium: false,
  },
  {
    id: "education-warm",
    name: "暖色课堂",
    category: "教育",
    description: "友好圆润、色彩柔和，适合教学课件与培训",
    stylePrompt:
      "Friendly educational slides, warm cream background, rounded shapes, soft coral and teal accents, approachable illustrations style",
    colors: ["#fff7ed", "#ea580c", "#0d9488"],
    preview: "linear-gradient(135deg,#fff7ed 0%,#ffedd5 100%)",
    isPremium: false,
  },
  {
    id: "vibrant-marketing",
    name: "活力营销",
    category: "活泼",
    description: "高饱和撞色与大标题，适合活动推广与社交媒体",
    stylePrompt:
      "Bold marketing deck, vibrant pink and electric blue gradients, oversized headlines, dynamic diagonal shapes, Gen-Z energy",
    colors: ["#ec4899", "#3b82f6", "#fef08a"],
    preview: "linear-gradient(135deg,#ec4899 0%,#8b5cf6 50%,#3b82f6 100%)",
    isPremium: true,
  },
  {
    id: "forest-nature",
    name: "自然绿意",
    category: "商务",
    description: "环保、可持续主题，绿色系专业设计",
    stylePrompt:
      "Sustainable business presentation, forest green and sage palette, organic curves, nature-inspired subtle textures, ESG report style",
    colors: ["#14532d", "#86efac", "#f0fdf4"],
    preview: "linear-gradient(135deg,#14532d 0%,#166534 100%)",
    isPremium: false,
  },
  {
    id: "luxury-gold",
    name: "黑金奢华",
    category: "商务",
    description: "黑金配色，适合奢侈品、高端服务介绍",
    stylePrompt:
      "Luxury brand presentation, black background, gold foil typography accents, art deco subtle patterns, premium fashion show aesthetic",
    colors: ["#0a0a0a", "#d4af37", "#fafafa"],
    preview: "linear-gradient(135deg,#0a0a0a 0%,#1a1a1a 50%,#292524 100%)",
    isPremium: true,
  },
  {
    id: "data-dashboard",
    name: "数据洞察",
    category: "科技",
    description: "图表友好布局，适合数据分析与季度复盘",
    stylePrompt:
      "Data analytics presentation, dark slate background, chart-friendly grid layout, blue and green data visualization accents, dashboard UI style",
    colors: ["#1e293b", "#38bdf8", "#34d399"],
    preview: "linear-gradient(135deg,#1e293b 0%,#0f172a 100%)",
    isPremium: false,
  },
  {
    id: "pastel-creative",
    name: "粉彩创意",
    category: "活泼",
    description: "马卡龙色系，适合创意提案与设计作品集",
    stylePrompt:
      "Creative agency deck, soft pastel pink lavender mint colors, playful geometric shapes, portfolio showcase layout, dribbble aesthetic",
    colors: ["#fce7f3", "#ddd6fe", "#a7f3d0"],
    preview: "linear-gradient(135deg,#fce7f3 0%,#ddd6fe 50%,#a7f3d0 100%)",
    isPremium: false,
  },
  {
    id: "government-blue",
    name: "政务蓝",
    category: "商务",
    description: "稳重蓝色系，适合政府、国企正式汇报",
    stylePrompt:
      "Formal government presentation, official blue and white, structured hierarchical layout, serious trustworthy tone, Chinese government report style",
    colors: ["#1e40af", "#ffffff", "#dc2626"],
    preview: "linear-gradient(180deg,#1e40af 0%,#1d4ed8 100%)",
    isPremium: false,
  },
  {
    id: "startup-pitch",
    name: "创业路演",
    category: "科技",
    description: "Y Combinator 风格，突出问题-方案- traction",
    stylePrompt:
      "Y Combinator startup pitch deck, clean white background, bold problem-solution narrative, metric callout boxes, investor-ready simplicity",
    colors: ["#ffffff", "#f97316", "#111827"],
    preview: "linear-gradient(180deg,#ffffff 0%,#fff7ed 100%)",
    isPremium: false,
  },
  {
    id: "medical-clean",
    name: "医疗健康",
    category: "教育",
    description: "洁净蓝白，适合医疗、健康、科研分享",
    stylePrompt:
      "Medical healthcare presentation, clinical white and trust blue, clean icons, patient-friendly professional, hospital annual report style",
    colors: ["#eff6ff", "#0284c7", "#ffffff"],
    preview: "linear-gradient(180deg,#eff6ff 0%,#dbeafe 100%)",
    isPremium: false,
  },
];

export function getTemplateById(id: string) {
  return TEMPLATES.find((t) => t.id === id);
}
