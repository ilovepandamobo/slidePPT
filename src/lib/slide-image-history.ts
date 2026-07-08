export type SlideImageVariant = {
  id: string;
  imageUrl: string;
  createdAt: string;
  label?: string;
};

export function parseImageHistory(raw: string | null | undefined): SlideImageVariant[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SlideImageVariant[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function serializeImageHistory(items: SlideImageVariant[]): string {
  return JSON.stringify(items);
}

/** 将当前图存入历史（去重），返回更新后的历史 */
export function pushImageToHistory(
  history: SlideImageVariant[],
  imageUrl: string,
  label?: string
): SlideImageVariant[] {
  if (!imageUrl) return history;
  if (history.some((h) => h.imageUrl === imageUrl)) return history;
  return [
    {
      id: `v-${Date.now()}`,
      imageUrl,
      createdAt: new Date().toISOString(),
      label: label || "历史版本",
    },
    ...history,
  ].slice(0, 12);
}
