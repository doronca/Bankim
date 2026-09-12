import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH { name?, icon?, order? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { name?: string; icon?: string; order?: number };
  const entity = await prisma.entity.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.icon !== undefined ? { icon: body.icon.trim() || null } : {}),
      ...(body.order !== undefined ? { order: body.order } : {}),
    },
  });
  return NextResponse.json(entity);
}

// DELETE: removes the entity. Accounts and rules assigned to it fall back to
// unassigned (entityId = null) via the FK's ON DELETE SET NULL.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.entity.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
