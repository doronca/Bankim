import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/transactions/dedupe
//
// Removes exact-duplicate transactions: same account, date, amount, and
// description. Seen with OpenFinance sandbox data that occasionally hands
// back a fresh random sourceRef for what's really the same transaction,
// which defeats the sync's normal (accountMappingId, sourceRef) idempotency
// key. Keeps the oldest row in each duplicate group (closest to the
// original import) and deletes the rest; a note or category set on any
// duplicate is preserved by merging onto the kept row before the others are
// deleted, so a manual edit on a since-removed duplicate isn't lost.
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
    if (!keep || dupes.length === 0) continue;

    // Carry over anything a duplicate had that the kept row doesn't.
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
    removed += dupes.length;
  }

  return NextResponse.json({ affectedGroups, removed });
}
