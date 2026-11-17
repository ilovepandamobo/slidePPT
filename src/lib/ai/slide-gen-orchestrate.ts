/**
 * GrsAI 批量出图策略（4K/标清）：
 * 1. 首轮：所有页并行，仅 GrsAI
 * 2. 失败页：成批再并行一轮；成批中任一页再败 → 立刻单页快重试
 * 3. 单页 GrsAI 累计失败 3 次 → 该页改走乘丰（仅 HD）
 */

import { mapWithConcurrency } from "@/lib/generation-concurrency";
import type { HdImageChannel } from "@/lib/ai/grsai-hd";

export const GRSAI_MAX_ATTEMPTS_BEFORE_FENG =
  Number(process.env.GRSAI_IMAGE_RETRY_BEFORE_FENG) || 3;

export const GRSAI_SOLO_RETRY_DELAY_MS =
  Number(process.env.GRSAI_SOLO_RETRY_DELAY_MS) || 500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type SlideGenWork<T> = {
  item: T;
  grsaiFails: number;
  done: boolean;
};

export type TryGrsaiFn<T> = (
  item: T,
  channel: HdImageChannel
) => Promise<void>;

export type TryFengFn<T> = (item: T) => Promise<void>;

/** 单页已在 API 内按通道调用时使用 */
export async function runGrsaiFirstSlidePolicy(
  tryGrsai: () => Promise<void>,
  tryFeng: () => Promise<void>,
  useFengFallback: boolean
): Promise<void> {
  for (let attempt = 1; attempt <= GRSAI_MAX_ATTEMPTS_BEFORE_FENG; attempt++) {
    try {
      await tryGrsai();
      return;
    } catch (e) {
      console.warn(
        `[slide-gen] GrsAI attempt ${attempt}/${GRSAI_MAX_ATTEMPTS_BEFORE_FENG} failed:`,
        e instanceof Error ? e.message : e
      );
      if (attempt < GRSAI_MAX_ATTEMPTS_BEFORE_FENG) {
        await sleep(GRSAI_SOLO_RETRY_DELAY_MS);
      }
    }
  }
  if (useFengFallback) {
    await tryFeng();
    return;
  }
  throw new Error(
    `GrsAI 连续失败 ${GRSAI_MAX_ATTEMPTS_BEFORE_FENG} 次，请稍后重试或改用标准画质`
  );
}

/**
 * 多页：首轮全员 GrsAI 并行；失败组成批重试 + 批内败了立刻单页快重试；满 3 次 GrsAI 失败走乘丰。
 */
export async function runGrsaiFirstBatchPolicy<T>(
  items: T[],
  concurrency: number,
  tryGrsai: TryGrsaiFn<T>,
  tryFeng: TryFengFn<T> | null
): Promise<{ failed: T[] }> {
  const works: SlideGenWork<T>[] = items.map((item) => ({
    item,
    grsaiFails: 0,
    done: false,
  }));

  const markSuccess = (w: SlideGenWork<T>) => {
    w.done = true;
  };

  const tryGrsaiOnce = async (w: SlideGenWork<T>): Promise<boolean> => {
    try {
      await tryGrsai(w.item, "grsai-only");
      markSuccess(w);
      return true;
    } catch (e) {
      w.grsaiFails++;
      console.warn(
        `[slide-gen] slide GrsAI fail #${w.grsaiFails}:`,
        e instanceof Error ? e.message : e
      );
      return false;
    }
  };

  const tryFengOnce = async (w: SlideGenWork<T>) => {
    if (!tryFeng) throw new Error("GrsAI 失败且无乘丰回退");
    await tryFeng(w.item);
    markSuccess(w);
  };

  const pending = () => works.filter((w) => !w.done);

  console.info(
    `[slide-gen] wave1 GrsAI parallel count=${works.length} concurrency=${concurrency}`
  );
  await mapWithConcurrency(works, concurrency, async (w) => {
    if (w.done) return;
    await tryGrsaiOnce(w);
  });

  let round = 2;
  while (pending().length > 0) {
    const needGrsai = pending().filter(
      (w) => w.grsaiFails < GRSAI_MAX_ATTEMPTS_BEFORE_FENG
    );
    const exhausted = pending().filter(
      (w) => w.grsaiFails >= GRSAI_MAX_ATTEMPTS_BEFORE_FENG
    );

    for (const w of exhausted) {
      try {
        await tryFengOnce(w);
      } catch (e) {
        console.error(
          "[slide-gen] Feng fallback failed:",
          e instanceof Error ? e.message : e
        );
      }
    }

    if (needGrsai.length === 0) break;

    console.info(
      `[slide-gen] wave${round} batch-retry failed=${needGrsai.length} concurrency=${concurrency}`
    );

    await mapWithConcurrency(needGrsai, concurrency, async (w) => {
      const ok = await tryGrsaiOnce(w);
      if (ok) return;

      if (w.grsaiFails < GRSAI_MAX_ATTEMPTS_BEFORE_FENG) {
        console.info("[slide-gen] immediate solo GrsAI retry");
        await sleep(GRSAI_SOLO_RETRY_DELAY_MS);
        const okSolo = await tryGrsaiOnce(w);
        if (okSolo) return;
      }

      if (w.grsaiFails >= GRSAI_MAX_ATTEMPTS_BEFORE_FENG && tryFeng) {
        try {
          await tryFengOnce(w);
        } catch (e) {
          console.error(
            "[slide-gen] Feng after 3x GrsAI failed:",
            e instanceof Error ? e.message : e
          );
        }
      }
    });

    round++;
    if (round > 20) {
      console.error("[slide-gen] batch policy safety stop at 20 rounds");
      break;
    }

    if (
      pending().every((w) => w.grsaiFails >= GRSAI_MAX_ATTEMPTS_BEFORE_FENG) &&
      pending().length === exhausted.length
    ) {
      break;
    }
  }

  return { failed: pending().map((w) => w.item) };
}