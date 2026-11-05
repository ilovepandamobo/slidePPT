import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { persistStyleReference } from "@/lib/storage/style-reference";
import { formatStorageWriteError } from "@/lib/storage/disk-space";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file || !file.type.startsWith("image/")) {
      return NextResponse.json({ error: "请上传图片文件" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    const saved = await persistStyleReference(dataUrl);

    return NextResponse.json({
      path: saved.path,
      url: saved.path,
      fileName: file.name,
      size: file.size,
    });
  } catch (e) {
    const message = formatStorageWriteError(e);
    return NextResponse.json({ error: message }, { status: 507 });
  }
}
