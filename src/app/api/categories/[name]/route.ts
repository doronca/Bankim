import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH { groupId: string | null }: assigns/removes a category's group.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const body = (await req.json()) as { groupId: string | null };
  const category = await prisma.category.upsert({
    where: { name: decodeURIComponent(name) },
    update: { groupId: body.groupId },
    create: { name: decodeURIComponent(name), groupId: body.groupId },
  });
  return NextResponse.json(category);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  await prisma.category.delete({ where: { name: decodeURIComponent(name) } });
  return NextResponse.json({ ok: true });
}
