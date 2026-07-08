import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const media = await prisma.media.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ media });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "无文件" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const base64 = buffer.toString("base64");
  const mime = file.type || "image/png";
  const url = `data:${mime};base64,${base64}`;

  const media = await prisma.media.create({
    data: {
      userId: session.id,
      name: file.name,
      url,
      mimeType: mime,
      size: file.size,
      folder: (formData.get("folder") as string) || "default",
    },
  });

  return NextResponse.json({ media });
}
