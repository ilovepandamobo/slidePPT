export type GenerateFailure = {
  order: number;
  title: string;
  error: string;
};

export type GenerateApiResponse = {
  project?: { id?: string; slides?: unknown[] };
  error?: string;
  failures?: GenerateFailure[];
  partial?: boolean;
  allFailed?: boolean;
};

/** 安全解析 /generate 响应，避免非 JSON（超时/HTML）导致整批结果被丢弃 */
export async function parseGenerateResponse(
  res: Response
): Promise<GenerateApiResponse> {
  const text = await res.text();
  if (!text.trim()) {
    return {
      error: res.ok
        ? "服务器返回空响应"
        : `请求未完成 (HTTP ${res.status})，请到编辑器查看是否已有部分页面生成`,
    };
  }
  try {
    return JSON.parse(text) as GenerateApiResponse;
  } catch {
    return {
      error:
        "服务器响应格式异常，请到编辑器查看是否已有部分页面生成",
    };
  }
}

export function formatGenerateFailures(
  failures: GenerateFailure[] | undefined
): string {
  if (!failures?.length) return "";
  return failures
    .map((f) => `第${f.order}页「${f.title}」: ${f.error}`)
    .join("\n");
}

export function summarizeGenerateResult(data: GenerateApiResponse): string | null {
  if (data.failures?.length) {
    const detail = formatGenerateFailures(data.failures);
    const done =
      data.project?.slides?.filter(
        (s) =>
          typeof s === "object" &&
          s !== null &&
          "status" in s &&
          (s as { status: string }).status === "done"
      ).length ?? 0;
    if (done > 0) {
      return `部分页面生成失败（${data.failures.length} 页），${done} 页已成功，可在编辑器中查看并重试失败页：\n${detail}`;
    }
    return `全部页面生成失败：\n${detail}`;
  }
  if (data.error && !data.project) return data.error;
  if (data.error) return `${data.error}\n请到编辑器查看项目状态。`;
  return null;
}
