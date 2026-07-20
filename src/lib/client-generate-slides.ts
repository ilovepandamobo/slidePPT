import { mapWithConcurrency } from "@/lib/generation-concurrency";
import {
  formatGenerateFailures,
  parseGenerateResponse,
  type GenerateFailure,
} from "@/lib/generate-response";

/** 前端并发请求数（每页一个 /generate，同时打 GrsAI） */
const DEFAULT_CLIENT_CONCURRENCY = 12;

export async function generateSlidesParallel(
  projectId: string,
  slideIds: string[],
  options?: {
    concurrency?: number;
    onProgress?: (done: number, total: number) => void;
  }
): Promise<{ failures: GenerateFailure[] }> {
  if (slideIds.length === 0) return { failures: [] };

  const concurrency = Math.min(
    options?.concurrency ?? DEFAULT_CLIENT_CONCURRENCY,
    slideIds.length
  );
  const failures: GenerateFailure[] = [];
  let done = 0;

  await mapWithConcurrency(slideIds, concurrency, async (slideId) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slideIds: [slideId] }),
      });
      const data = await parseGenerateResponse(res);
      if (data.failures?.length) {
        failures.push(...data.failures);
      } else if (!res.ok) {
        failures.push({
          order: done + 1,
          title: slideId,
          error: data.error || `HTTP ${res.status}`,
        });
      }
    } catch (e) {
      failures.push({
        order: done + 1,
        title: slideId,
        error: e instanceof Error ? e.message : "请求失败",
      });
    } finally {
      done++;
      options?.onProgress?.(done, slideIds.length);
    }
  });

  return { failures };
}

export function summarizeParallelFailures(
  failures: GenerateFailure[],
  total: number
): string | null {
  if (failures.length === 0) return null;
  const detail = formatGenerateFailures(failures);
  const ok = total - failures.length;
  if (ok > 0) {
    return `部分页面生成失败（${failures.length}/${total} 页），${ok} 页已成功：\n${detail}`;
  }
  return `全部页面生成失败：\n${detail}`;
}
