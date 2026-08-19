import { statfs } from "fs/promises";

export function isEnospcError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as NodeJS.ErrnoException;
  return e.code === "ENOSPC" || /no space left on device/i.test(e.message || "");
}

export function formatStorageWriteError(error: unknown): string {
  if (isEnospcError(error)) {
    return "服务器存储空间已满，暂时无法上传。请联系管理员清理空间，或删除旧项目后重试。";
  }
  return error instanceof Error ? error.message : "写入失败";
}

/** 写入前检查可用空间（字节），不足时提前报错 */
export async function assertDiskSpace(
  dir: string,
  requiredBytes: number
): Promise<void> {
  try {
    const info = await statfs(dir);
    const free = info.bavail * info.bsize;
    if (free < requiredBytes) {
      throw Object.assign(new Error("ENOSPC: no space left on device"), {
        code: "ENOSPC",
      });
    }
  } catch (e) {
    if (isEnospcError(e)) throw e;
    // statfs 不可用时跳过（如部分本地环境）
  }
}
