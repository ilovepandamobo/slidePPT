import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { persistSlideImage } from "@/lib/storage/slide-image";
import { formatStorageWriteError } from "@/lib/storage/disk-space";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file || !file.size) {
    return NextResponse.json({ error: "请选择图片文件" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "仅支持图片文件" }, { status: 400 });
  }

  try {
    const bytes = await file.arrayBuffer();
    const mime = file.type || "image/png";
    const dataUrl = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
    const url = await persistSlideImage(dataUrl);
    return NextResponse.json({ url, name: file.name });
  } catch (e) {
    const msg = formatStorageWriteError(e);
    return NextResponse.json({ error: msg }, { status: 507 });
  }
}
