import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH { note?: string, linkedCardId?: string | null }: sets or clears a
// transaction's free-text note and/or its manual card link (see
// Transaction.linkedCard — ties a bank-account debit to the specific credit
// card it's charging, for cases the automatic matching can't disambiguate).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { note?: string; linkedCardId?: string | null };
  const data: { note?: string | null; linkedCardId?: string | null } = {};
  if ("note" in body) data.note = body.note?.trim() || null;
  if ("linkedCardId" in body) data.linkedCardId = body.linkedCardId || null;
  const updated = await prisma.transaction.update({ where: { id }, data });
  return NextResponse.json(updated);
}
