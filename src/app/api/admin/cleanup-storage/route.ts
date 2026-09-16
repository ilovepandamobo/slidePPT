import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runStorageCleanup } from "@/lib/storage/cleanup";

/** 清理未引用的图片文件，释放 Railway Volume 空间 */
export async function POST(req: Request) {
  const secret = process.env.CLEANUP_SECRET?.trim();
  const auth = req.headers.get("authorization");
  const allowedBySecret =
    secret && auth === `Bearer ${secret}`;

  if (!allowedBySecret) {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
  }

  try {
    const url = new URL(req.url);
    const trimHistory = url.searchParams.get("trimHistory") === "1";
    const result = await runStorageCleanup({ trimHistory });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "清理失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
