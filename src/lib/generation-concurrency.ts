/**
 * 并发生成数。默认=全部页面一起请求（上限 20）。
 * .env: GENERATION_CONCURRENCY=5 可改回限制并发。
 */
export function getGenerationConcurrency(slideCount: number): number {
  const raw = process.env.GENERATION_CONCURRENCY;
  if (raw !== undefined && raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1) {
      return Math.min(Math.floor(n), 20);
    }
  }
  return Math.min(Math.max(slideCount, 1), 20);
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
