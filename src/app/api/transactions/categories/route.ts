import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Distinct category strings actually used on transactions — for the filter
// dropdown, which should offer real values even before anyone's touched the
// Category catalog (used separately for grouping/autocomplete). An optional
// ?entity= scopes the list to categories actually used within that entity,
// so the filter doesn't offer categories that don't apply there.
export async function GET(req: NextRequest) {
  const entityId = req.nextUrl.searchParams.get("entity");
  const rows = await prisma.transaction.findMany({
    where: { category: { not: null }, accountMapping: entityId ? { entityId } : undefined },
    select: { category: true },
    distinct: ["category"],
  });
  const categories = rows.map((r) => r.category as string).sort();
  return NextResponse.json(categories);
}
