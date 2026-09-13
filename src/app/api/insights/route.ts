import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runInsightsEngine } from "@/lib/insights/engine";
import { formatInsight } from "@/lib/insights/format";
import type { Locale } from "@/lib/i18n";

// GET /api/insights?entity=<entityId>&locale=<he|en>
// Returns non-dismissed insights for one entity plus the always-included
// cross-entity ones (entityId = null). Omit `entity` for every insight
// across all entities (the aggregate dashboard view). `locale` renders the
// title/message/actionText in the requested language (default "he").
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const entityId = searchParams.get("entity");
  const locale: Locale = searchParams.get("locale") === "en" ? "en" : "he";

  const where = entityId ? { OR: [{ entityId }, { entityId: null }], dismissed: false } : { dismissed: false };

  const insights = await prisma.insight.findMany({
    where,
    include: { entity: { select: { name: true, icon: true } } },
    orderBy: [{ severity: "desc" }, { computedAt: "desc" }],
  });

  return NextResponse.json(
    insights.map((i) => {
      const metadata = i.metadata ? JSON.parse(i.metadata) : null;
      const rendered = formatInsight(
        { ruleKey: i.ruleKey, type: i.type, title: i.title, message: i.message, actionText: i.actionText, metadata, entityName: i.entity?.name ?? null },
        locale
      );
      return {
        id: i.id,
        entityId: i.entityId,
        entityName: i.entity?.name ?? null,
        type: i.type,
        severity: i.severity,
        title: rendered.title,
        message: rendered.message,
        actionText: rendered.actionText,
        amount: i.amount,
        metadata,
        computedAt: i.computedAt,
      };
    })
  );
}

// POST /api/insights — recomputes every rule for every entity.
export async function POST() {
  const result = await runInsightsEngine();
  return NextResponse.json(result);
}
