import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Simple key-value settings store. Currently used for the default
// recategorize scope ("single" | "entity" | "global").
export async function GET(req: NextRequest) {
  const key = new URL(req.url).searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 });
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return NextResponse.json({ value: row?.value ?? null });
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as { key: string; value: string };
  const row = await prisma.appSetting.upsert({
    where: { key: body.key },
    update: { value: body.value },
    create: { key: body.key, value: body.value },
  });
  return NextResponse.json(row);
}
