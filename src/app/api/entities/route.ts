import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// A fresh install has zero entities. Rather than make onboarding handle an
// empty list specially, lazily create one default entity the first time
// anyone asks — the UI then treats it as "1 entity" (switcher hidden) same
// as any other single-entity setup.
export async function GET() {
  const count = await prisma.entity.count();
  if (count === 0) {
    await prisma.entity.create({ data: { name: "Personal", icon: "👤", order: 0 } });
  }
  const entities = await prisma.entity.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json(entities);
}

// POST { name, icon? }: adds a new entity, appended to the end of the order.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { name: string; icon?: string };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const maxOrder = await prisma.entity.aggregate({ _max: { order: true } });
  const entity = await prisma.entity.create({
    data: {
      name: body.name.trim(),
      icon: body.icon?.trim() || null,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });
  return NextResponse.json(entity);
}
