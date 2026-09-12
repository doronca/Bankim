import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/dashboard/subscriptions/search?q=netflix&entity=<id>
// Finds merchants (by normalized text) matching a search string, regardless
// of how many charges they have — used to let the user flag a brand-new
// subscription (only one charge so far) that hasn't shown a cadence yet.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim().toLowerCase();
  const entityId = searchParams.get("entity");
  if (!q || q.length < 2) return NextResponse.json([]);

  const transactions = await prisma.transaction.findMany({
    where: {
      amount: { lt: 0 },
      description: { contains: q },
      accountMapping: entityId ? { entityId } : undefined,
    },
    select: { merchantNormalized: true, description: true, date: true, amount: true, category: true },
    orderBy: { date: "desc" },
    take: 500,
  });

  const groups = new Map<
    string,
    { count: number; lastDate: string; lastAmount: number; category: string | null }
  >();
  for (const tx of transactions) {
    const key = (tx.merchantNormalized ?? tx.description).trim().toLowerCase();
    if (!key) continue;
    const cur = groups.get(key);
    if (!cur) {
      groups.set(key, {
        count: 1,
        lastDate: tx.date.toISOString(),
        lastAmount: Math.abs(tx.amount),
        category: tx.category,
      });
    } else {
      cur.count++;
    }
  }

  const results = [...groups.entries()].map(([merchant, v]) => ({ merchant, ...v }));
  return NextResponse.json(results);
}
