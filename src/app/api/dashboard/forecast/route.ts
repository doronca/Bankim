import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adjustToNextBusinessDay } from "@/lib/ingest/hebcal";

// GET /api/dashboard/forecast?entity=<entityId>
//
// For every credit card (optionally scoped to one entity), estimates what's
// about to be charged and when:
//  - pendingAmount: real pending charges when OpenFinance reports isInvoiced
//    (charges posted but not yet billed); otherwise falls back to "since the
//    last estimated billing date" and is flagged isEstimate: true.
//  - nextChargeDate: derived from the same "matching lump-sum debit in the
//    linked checking account" heuristic used by /account-mappings/billing-estimate.
export async function GET(req: NextRequest) {
  const entityId = req.nextUrl.searchParams.get("entity");

  const [cards, bankAccounts] = await Promise.all([
    prisma.accountMapping.findMany({
      where: { accountType: "credit_card", ...(entityId ? { entityId } : {}) },
      include: { entity: true, transactions: { where: { amount: { lt: 0 } } } },
    }),
    prisma.accountMapping.findMany({
      where: { accountType: "bank_account" },
      include: { transactions: { where: { amount: { lt: 0 } }, select: { description: true, date: true } } },
    }),
  ]);

  const now = new Date();
  const result = await Promise.all(cards.map(async (card) => {
    // Debit cards settle immediately against the bank account, so they have
    // no monthly billing cycle to detect or require.
    if (card.isImmediateDebit) {
      const futureTransactionsCount = card.transactions.filter((tx) => tx.date.getTime() > now.getTime()).length;
      return {
        id: card.id,
        name: card.nickname ?? card.displayName,
        nickname: card.nickname,
        accountNumber: card.accountNumber,
        entityId: card.entityId,
        entityName: card.entity?.name ?? null,
        currency: card.currency,
        pendingAmount: 0,
        previousAmount: null,
        pendingCount: 0,
        isEstimate: false,
        nextChargeDate: null,
        dayOfMonth: null,
        dayOfMonthIsManual: false,
        isImmediateDebit: true,
        billingDayRequired: false,
        maxChargeAmount: null,
        chargeAmount: 0,
        rolloverAmount: 0,
        futureTransactionsCount,
      };
    }

    const last4 = card.accountNumber?.replace(/[^0-9]/g, "").slice(-4);
    const nameNeedle = card.displayName?.trim();

    const matchedDates: Date[] = [];
    for (const bank of bankAccounts) {
      if (bank.entityId !== card.entityId) continue;
      for (const tx of bank.transactions) {
        const desc = tx.description ?? "";
        const matchesDigits = last4 && desc.includes(last4);
        const matchesName = nameNeedle && nameNeedle.length > 3 && desc.includes(nameNeedle);
        if (matchesDigits || matchesName) matchedDates.push(tx.date);
      }
    }

    let dayOfMonth: number | null = null;
    let dayOfMonthIsManual = false;
    if (matchedDates.length >= 2) {
      const counts = new Map<number, number>();
      for (const d of matchedDates) counts.set(d.getDate(), (counts.get(d.getDate()) ?? 0) + 1);
      const [modeDay, modeCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      dayOfMonth = modeCount >= 2 ? modeDay : null;
    }
    // A manual override (set on the Forecast screen when detection fails)
    // always wins over the heuristic.
    if (card.billingDayOverride) {
      dayOfMonth = card.billingDayOverride;
      dayOfMonthIsManual = true;
    }

    let nextChargeDate: string | null = null;
    if (dayOfMonth) {
      const candidate = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
      if (candidate.getTime() < now.getTime()) candidate.setMonth(candidate.getMonth() + 1);
      // Israeli banks postpone a charge that falls on Shabbat/a holiday to
      // the nearest following business day, rather than settling on it.
      const settled = await adjustToNextBusinessDay(candidate);
      nextChargeDate = settled.toISOString().slice(0, 10);
    }

    const invoicedKnown = card.transactions.some((tx) => tx.isInvoiced !== null);
    let pendingTx = card.transactions;
    let isEstimate = false;
    if (invoicedKnown) {
      pendingTx = card.transactions.filter((tx) => tx.isInvoiced === false);
    } else {
      isEstimate = true;
      // Fall back to "since the last billing date" (or the last 30 days if
      // no billing date could be estimated) as a rough stand-in.
      let sinceDate: Date;
      if (dayOfMonth) {
        sinceDate = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
        if (sinceDate.getTime() > now.getTime()) sinceDate.setMonth(sinceDate.getMonth() - 1);
      } else {
        sinceDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      pendingTx = card.transactions.filter((tx) => tx.date.getTime() >= sinceDate.getTime());
    }

    const pendingAmount = pendingTx.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const futureTransactionsCount = card.transactions.filter((tx) => tx.date.getTime() > now.getTime()).length;

    // Revolving-credit cards ("אשראי מתגלגל"): the bank never charges more
    // than maxChargeAmount on the billing day — the rest carries into next
    // cycle's charge as an interest-bearing balance rather than settling now.
    const hasCap = card.maxChargeAmount != null && card.maxChargeAmount > 0;
    const chargeAmount = hasCap ? Math.min(pendingAmount, card.maxChargeAmount!) : pendingAmount;
    const rolloverAmount = hasCap ? Math.max(0, pendingAmount - card.maxChargeAmount!) : 0;

    // The prior cycle's total, for a "compared to last time" reference point
    // — only computable once we know the billing day.
    let previousAmount: number | null = null;
    if (dayOfMonth) {
      const cycleStart = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
      if (cycleStart.getTime() > now.getTime()) cycleStart.setMonth(cycleStart.getMonth() - 1);
      const prevCycleStart = new Date(cycleStart);
      prevCycleStart.setMonth(prevCycleStart.getMonth() - 1);
      previousAmount = card.transactions
        .filter((tx) => tx.date.getTime() >= prevCycleStart.getTime() && tx.date.getTime() < cycleStart.getTime())
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    }

    return {
      id: card.id,
      name: card.nickname ?? card.displayName,
      nickname: card.nickname,
      accountNumber: card.accountNumber,
      entityId: card.entityId,
      entityName: card.entity?.name ?? null,
      currency: card.currency,
      pendingAmount,
      previousAmount,
      pendingCount: pendingTx.length,
      isEstimate,
      nextChargeDate,
      dayOfMonth,
      dayOfMonthIsManual,
      isImmediateDebit: false,
      maxChargeAmount: card.maxChargeAmount,
      chargeAmount,
      rolloverAmount,
      // Without a known billing day, future card charges can't be placed on
      // a bank-account timeline — the UI should prompt the user to set one.
      billingDayRequired: !dayOfMonth,
      futureTransactionsCount,
    };
  }));

  const totals = {
    pendingAmount: result.reduce((sum, c) => sum + c.pendingAmount, 0),
    futureTransactionsCount: result.reduce((sum, c) => sum + c.futureTransactionsCount, 0),
  };

  return NextResponse.json({ cards: result, totals });
}
