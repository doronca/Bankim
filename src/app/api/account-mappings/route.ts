import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: list all discovered account mappings (used by onboarding + settings UI).
export async function GET() {
  const mappings = await prisma.accountMapping.findMany({
    include: { entity: true, mergedInto: true },
    orderBy: [{ entityId: "asc" }, { source: "asc" }],
  });
  return NextResponse.json(mappings);
}

// PATCH: assign one account/card/portfolio to an entity, set a nickname,
// and/or merge it into (or unmerge it from) another account that the bank
// happens to report as a separate row for what's really the same account.
// Body: { id: string, entityId?: string | null, nickname?: string, mergedIntoId?: string | null }
export async function PATCH(req: NextRequest) {
  const body = (await req.json()) as {
    id: string;
    entityId?: string | null;
    nickname?: string;
    mergedIntoId?: string | null;
    billingDayOverride?: number | null;
  };

  if (
    body.billingDayOverride !== undefined &&
    body.billingDayOverride !== null &&
    (body.billingDayOverride < 1 || body.billingDayOverride > 31)
  ) {
    return NextResponse.json({ error: "billingDayOverride must be between 1 and 31" }, { status: 400 });
  }

  if (body.entityId) {
    const exists = await prisma.entity.findUnique({ where: { id: body.entityId } });
    if (!exists) return NextResponse.json({ error: "Unknown entity" }, { status: 400 });
  }

  let inheritedEntityId: string | null | undefined;
  if (body.mergedIntoId) {
    if (body.mergedIntoId === body.id) {
      return NextResponse.json({ error: "Cannot merge an account into itself" }, { status: 400 });
    }
    const target = await prisma.accountMapping.findUnique({ where: { id: body.mergedIntoId } });
    if (!target) return NextResponse.json({ error: "Unknown target account" }, { status: 400 });
    if (target.mergedIntoId) {
      return NextResponse.json({ error: "Cannot merge into an account that is itself merged" }, { status: 400 });
    }
    // A merged account is treated as part of its target everywhere in the
    // UI, so it should live in the same entity — inherit it automatically.
    inheritedEntityId = target.entityId;
  }

  const updated = await prisma.accountMapping.update({
    where: { id: body.id },
    data: {
      ...(body.entityId !== undefined ? { entityId: body.entityId } : {}),
      ...(body.nickname !== undefined ? { nickname: body.nickname.trim() || null } : {}),
      ...(body.mergedIntoId !== undefined ? { mergedIntoId: body.mergedIntoId } : {}),
      ...(inheritedEntityId !== undefined ? { entityId: inheritedEntityId } : {}),
      ...(body.billingDayOverride !== undefined ? { billingDayOverride: body.billingDayOverride } : {}),
    },
    include: { entity: true, mergedInto: true },
  });
  return NextResponse.json(updated);
}
