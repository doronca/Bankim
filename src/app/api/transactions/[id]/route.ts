import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH { note: string }: sets or clears a transaction's free-text note.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { note?: string };
  const updated = await prisma.transaction.update({
    where: { id },
    data: { note: body.note?.trim() || null },
  });
  return NextResponse.json(updated);
}
