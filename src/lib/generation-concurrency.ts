/** 与 grsai-images 中乘丰多 key 逻辑一致（勿 import grsai-images，避免构建环依赖） */
function countFengImagesApiKeys(): number {
  const list = process.env.GRSAI_IMAGES_API_KEYS?.trim();
  if (list) {
    return new Set(
      list.split(",").map((s) => s.trim()).filter(Boolean)
    ).size;
  }
  let n = 0;
  const k1 = process.env.GRSAI_IMAGES_API_KEY?.trim();
  const k2 = process.env.GRSAI_IMAGES_API_KEY_2?.trim();
  if (k1) n++;
  if (k2 && k2 !== k1) n++;
  if (n) return n;
  return process.env.GRSAI_API_KEY?.trim() ? 1 : 0;
}

/**
 * 并发生成数。高清 4K 默认 = 乘丰密钥个数（最多 2 路并行，每 key 一路）。
 * .env: GENERATION_CONCURRENCY 可覆盖。
 */
export function getGenerationConcurrency(
  slideCount: number,
  imageQuality?: string | null
): number {
  const raw = process.env.GENERATION_CONCURRENCY;
  if (raw !== undefined && raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1) {
      return Math.min(Math.floor(n), 20);
    }
  }
  let cap = 20;
  if (imageQuality === "hd") {
    const keys = Math.max(1, countFengImagesApiKeys());
    cap = Math.min(keys, 2);
  }
  return Math.min(Math.max(slideCount, 1), cap);
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}
