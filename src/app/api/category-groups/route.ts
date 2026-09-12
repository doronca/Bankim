import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const groups = await prisma.categoryGroup.findMany({
    orderBy: { order: "asc" },
    include: { categories: true },
  });
  return NextResponse.json(groups);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { name: string };
  if (!body.name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
  const maxOrder = await prisma.categoryGroup.aggregate({ _max: { order: true } });
  const group = await prisma.categoryGroup.create({
    data: { name: body.name.trim(), order: (maxOrder._max.order ?? -1) + 1 },
  });
  return NextResponse.json(group);
}
