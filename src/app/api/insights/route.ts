import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runInsightsEngine } from "@/lib/insights/engine";

// GET /api/insights?entity=<entityId>
// Returns non-dismissed insights for one entity plus the always-included
// cross-entity ones (entityId = null). Omit `entity` for every insight
// across all entities (the aggregate dashboard view).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const entityId = searchParams.get("entity");

  const where = entityId ? { OR: [{ entityId }, { entityId: null }], dismissed: false } : { dismissed: false };

  const insights = await prisma.insight.findMany({
    where,
    include: { entity: { select: { name: true, icon: true } } },
    orderBy: [{ severity: "desc" }, { computedAt: "desc" }],
  });

  return NextResponse.json(
    insights.map((i) => ({
      id: i.id,
      entityId: i.entityId,
      entityName: i.entity?.name ?? null,
      type: i.type,
      severity: i.severity,
      title: i.title,
      message: i.message,
      actionText: i.actionText,
      amount: i.amount,
      metadata: i.metadata ? JSON.parse(i.metadata) : null,
      computedAt: i.computedAt,
    }))
  );
}

// POST /api/insights — recomputes every rule for every entity.
export async function POST() {
  const result = await runInsightsEngine();
  return NextResponse.json(result);
}
