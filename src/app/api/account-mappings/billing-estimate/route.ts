import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: for each credit card, estimates its monthly billing/settlement day by
// finding the matching lump-sum debit in a sibling bank account — Israeli
// banks post the card's total as a single line item (e.g. "לאומי ויזה" or
// "חיוב לכרטיס ויזה 6098") in the linked checking account, distinct from the
// card's own list of individual purchases. Matched by the card's last-4
// digits or its display name appearing in the checking transaction text.
// Only reported when at least 2 matching charges agree on the same day
// (±2 days), otherwise omitted rather than guessing.
export async function GET() {
  const [cards, bankAccounts] = await Promise.all([
    prisma.accountMapping.findMany({ where: { accountType: "credit_card" } }),
    prisma.accountMapping.findMany({
      where: { accountType: "bank_account" },
      include: { transactions: { where: { amount: { lt: 0 } }, select: { description: true, date: true } } },
    }),
  ]);

  const result: Record<string, { dayOfMonth: number; sampleCount: number } | null> = {};

  for (const card of cards) {
    const last4 = card.accountNumber?.replace(/[^0-9]/g, "").slice(-4);
    const nameNeedle = card.displayName?.trim();

    const matchedDates: Date[] = [];
    for (const bank of bankAccounts) {
      if (bank.entityId !== card.entityId) continue; // only within the same book
      for (const tx of bank.transactions) {
        const desc = tx.description ?? "";
        const matchesDigits = last4 && desc.includes(last4);
        const matchesName = nameNeedle && nameNeedle.length > 3 && desc.includes(nameNeedle);
        if (matchesDigits || matchesName) matchedDates.push(tx.date);
      }
    }

    if (matchedDates.length < 2) {
      result[card.id] = null;
      continue;
    }

    const days = matchedDates.map((d) => d.getDate());
    const counts = new Map<number, number>();
    for (const d of days) counts.set(d, (counts.get(d) ?? 0) + 1);
    const [modeDay, modeCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];

    result[card.id] = modeCount >= 2 ? { dayOfMonth: modeDay, sampleCount: modeCount } : null;
  }

  return NextResponse.json(result);
}
