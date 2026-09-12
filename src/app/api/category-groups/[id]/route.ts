import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { name?: string };
  const group = await prisma.categoryGroup.update({
    where: { id },
    data: { ...(body.name !== undefined ? { name: body.name.trim() } : {}) },
  });
  return NextResponse.json(group);
}

// Deletes a group; its member categories become ungrouped (not deleted).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.categoryGroup.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
