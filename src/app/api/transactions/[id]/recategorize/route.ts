import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { categorizeSingleTransaction, learnAndApplyRule } from "@/lib/categorize/engine";

type Scope = "single" | "entity" | "global";

// POST: user recategorizes one transaction in the UI.
// Body: { category: string, scope: "single" | "entity" | "global" }
//  - "single": only this transaction changes, no rule is created
//  - "entity": a rule is created scoped to this transaction's entity
//  - "global": a rule is created that applies across all entities
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { category: string; scope?: Scope };
  const scope: Scope = body.scope ?? "entity";

  const tx = await prisma.transaction.findUnique({
    where: { id },
    include: { accountMapping: true },
  });
  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  if (scope === "single") {
    const updated = await categorizeSingleTransaction(id, body.category);
    return NextResponse.json({ transaction: updated, updatedCount: 1 });
  }

  const pattern = (tx.merchantNormalized ?? tx.description).trim();

  const result = await learnAndApplyRule({
    merchantPattern: pattern,
    category: body.category,
    entityId: scope === "entity" ? tx.accountMapping.entityId : null,
  });

  return NextResponse.json(result);
}
