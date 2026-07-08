import { NextResponse } from "next/server";
import { assistOutline } from "@/lib/ai/assist";
import { z } from "zod";

const schema = z.object({
  topic: z.string().min(1),
  audience: z.string().optional(),
  duration: z.number().optional(),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const outline = await assistOutline(
      body.topic,
      body.audience,
      body.duration
    );
    return NextResponse.json({ outline });
  } catch {
    return NextResponse.json({ error: "生成失败" }, { status: 400 });
  }
}
