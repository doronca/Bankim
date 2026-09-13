import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findNearDuplicateIds } from "@/lib/nearDuplicates";

// Reassigns tasks and merges note/category from a set of duplicate rows
// onto the row being kept, then deletes the duplicates.
async function mergeAndRemove(keep: { id: string; note: string | null; category: string | null }, dupes: { id: string; note: string | null; category: string | null }[]) {
  if (dupes.length === 0) return 0;
  const survivorNote = keep.note ?? dupes.find((d) => d.note)?.note ?? null;
  const survivorCategory = keep.category ?? dupes.find((d) => d.category)?.category ?? null;
  if (survivorNote !== keep.note || survivorCategory !== keep.category) {
    await prisma.transaction.update({
      where: { id: keep.id },
      data: { note: survivorNote, category: survivorCategory },
    });
  }
  // Tasks point at a transactionId with onDelete: Cascade — reattach them
  // to the survivor instead of losing them.
  await prisma.task.updateMany({
    where: { transactionId: { in: dupes.map((d) => d.id) } },
    data: { transactionId: keep.id },
  });
  await prisma.transaction.deleteMany({ where: { id: { in: dupes.map((d) => d.id) } } });
  return dupes.length;
}

// POST /api/transactions/dedupe
//
// Two passes of duplicate removal, both keeping the oldest/earliest row and
// merging any note or category from the rows removed onto it:
//
// 1. Exact duplicates: same account, date, amount, and description. Seen
//    with OpenFinance sandbox data that occasionally hands back a fresh
//    random sourceRef for what's really the same transaction, defeating the
//    sync's (accountMappingId, sourceRef) idempotency key.
// 2. Near-duplicates: a card charge reported once as a pending
//    authorization and again a few days later once it settles, under a
//    different sourceRef and a slightly later date — see
//    src/lib/nearDuplicates.ts. The ingest sync now catches this going
//    forward (src/lib/ingest/openfinance.ts); this cleans up rows imported
//    before that fix existed.
export async function POST() {
  const groups = await prisma.transaction.groupBy({
    by: ["accountMappingId", "date", "amount", "description"],
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
  });

  let removed = 0;
  const affectedGroups = groups.length;

  for (const g of groups) {
    const rows = await prisma.transaction.findMany({
      where: {
        accountMappingId: g.accountMappingId,
        date: g.date,
        amount: g.amount,
        description: g.description,
      },
      orderBy: { createdAt: "asc" },
    });
    const [keep, ...dupes] = rows;
    if (!keep) continue;
    removed += await mergeAndRemove(keep, dupes);
  }

  const allTransactions = await prisma.transaction.findMany({
    select: { id: true, accountMappingId: true, date: true, amount: true, description: true, note: true, category: true },
  });
  const nearDuplicateIds = findNearDuplicateIds(allTransactions);
  let nearDuplicatesRemoved = 0;
  if (nearDuplicateIds.size > 0) {
    // Group by the same key findNearDuplicateIds used, so note/category/tasks
    // from each removed row carry over onto its surviving (earliest-dated) match.
    const groupsByKey = new Map<string, typeof allTransactions>();
    for (const tx of allTransactions) {
      const key = `${tx.accountMappingId}|${tx.description}|${Math.round(tx.amount * 100)}`;
      (groupsByKey.get(key) ?? groupsByKey.set(key, []).get(key)!).push(tx);
    }
    for (const group of groupsByKey.values()) {
      const dupes = group.filter((t) => nearDuplicateIds.has(t.id));
      const keep = group.find((t) => !nearDuplicateIds.has(t.id));
      if (!keep || dupes.length === 0) continue;
      nearDuplicatesRemoved += await mergeAndRemove(keep, dupes);
    }
  }

  return NextResponse.json({
    affectedGroups,
    removed,
    nearDuplicatesRemoved,
  });
}
