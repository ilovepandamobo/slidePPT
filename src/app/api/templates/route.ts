import { NextResponse } from "next/server";
import { TEMPLATES } from "@/lib/templates-data";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  let list = TEMPLATES;
  if (category && category !== "全部") {
    list = list.filter((t) => t.category === category);
  }
  return NextResponse.json({ templates: list });
}
