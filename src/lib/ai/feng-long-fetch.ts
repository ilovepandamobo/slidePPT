/**
 * Node 内置 fetch（undici）默认 headersTimeout ≈ 300s，4K 生图常超过 5 分钟会报 fetch failed。
 * 乘丰通道单独拉长 headers/body 超时，与 GRSAI_IMAGES_TIMEOUT_MS 一致。
 */

import type { Dispatcher } from "undici";

const agents = new Map<number, Dispatcher>();

export async function fetchFengImages(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const { fetch: undiciFetch, Agent } = await import("undici");

  let dispatcher = agents.get(timeoutMs);
  if (!dispatcher) {
    dispatcher = new Agent({
      headersTimeout: timeoutMs,
      bodyTimeout: timeoutMs,
      connectTimeout: 120_000,
    });
    agents.set(timeoutMs, dispatcher);
  }

  const res = await undiciFetch(url, {
    method: init.method,
    headers: init.headers as Record<string, string> | undefined,
    body: init.body ?? undefined,
    signal: init.signal ?? undefined,
    dispatcher,
  });

  return res as unknown as Response;
}

export function formatFetchError(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const cause = e.cause;
  const causeStr =
    cause instanceof Error
      ? `${cause.name}: ${cause.message}`
      : cause != null
        ? String(cause)
        : "";
  return causeStr ? `${e.message} (${causeStr})` : e.message;
}
