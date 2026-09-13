import { prisma } from "@/lib/prisma";
import { adjustToNextBusinessDay } from "@/lib/ingest/hebcal";
import { findNearDuplicateIds } from "@/lib/nearDuplicates";

// Date-only ISO string from LOCAL date components. toISOString() converts to
// UTC first, which shifts the date backward by a day for any timezone ahead
// of UTC (e.g. Israel) — this keeps the calendar day the billing logic
// actually computed.
function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export interface CardForecastResult {
  id: string;
  name: string;
  nickname: string | null;
  accountNumber: string | null;
  displayName: string;
  entityId: string | null;
  entityName: string | null;
  currency: string;
  pendingAmount: number;
  previousAmount: number | null;
  pendingCount: number;
  // The cycle window backing pendingAmount, as local ISO dates — so the UI
  // can link straight to exactly those transactions instead of the card's
  // full history (which reads as if unrelated old transactions were part of
  // the pending total when they're really just older, already-billed spend).
  pendingSinceDate: string | null;
  isEstimate: boolean;
  nextChargeDate: string | null;
  dayOfMonth: number | null;
  dayOfMonthIsManual: boolean;
  isImmediateDebit: boolean;
  billingDayRequired: boolean;
  maxChargeAmount: number | null;
  chargeAmount: number;
  rolloverAmount: number;
  futureTransactionsCount: number;
}

// Estimates what's about to be charged and when, for every credit card
// (optionally scoped to one entity):
//  - pendingAmount: sum of transactions since the last billing date (see the
//    note below on why this doesn't use OpenFinance's `isInvoiced` flag).
//    isEstimate is true unless the billing day is a manual override — a
//    heuristic-detected or missing billing day makes the cycle window itself
//    an approximation.
//  - nextChargeDate: derived from the same "matching lump-sum debit in the
//    linked checking account" heuristic used by /account-mappings/billing-estimate.
//
// Shared between /api/dashboard/forecast (the Forecast screen) and
// /api/transactions (to tag a bank-account charge line with the specific
// card it belongs to, by amount/date rather than just description text).
export async function computeCardForecasts(entityId?: string | null): Promise<CardForecastResult[]> {
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

  // The ingest sync now catches a card charge being reported twice (once
  // pending, once settled a few days later under a different sourceRef —
  // see src/lib/nearDuplicates.ts) going forward, but rows imported before
  // that fix can still be sitting in the database — exclude them here too
  // so the forecast is accurate even before someone runs the dedupe cleanup.
  const nearDuplicateIds = findNearDuplicateIds(
    cards.flatMap((card) =>
      card.transactions.map((tx) => ({
        id: tx.id,
        accountMappingId: card.id,
        date: tx.date,
        amount: tx.amount,
        description: tx.description,
      }))
    )
  );

  const now = new Date();
  return Promise.all(cards.map(async (card): Promise<CardForecastResult> => {
    card = { ...card, transactions: card.transactions.filter((tx) => !nearDuplicateIds.has(tx.id)) };
    // Debit cards settle immediately against the bank account, so they have
    // no monthly billing cycle to detect or require.
    if (card.isImmediateDebit) {
      const futureTransactionsCount = card.transactions.filter((tx) => tx.date.getTime() > now.getTime()).length;
      return {
        id: card.id,
        name: card.nickname ?? card.displayName,
        nickname: card.nickname,
        accountNumber: card.accountNumber,
        displayName: card.displayName,
        entityId: card.entityId,
        entityName: card.entity?.name ?? null,
        currency: card.currency,
        pendingAmount: 0,
        previousAmount: null,
        pendingCount: 0,
        pendingSinceDate: null,
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
      nextChargeDate = toLocalDateString(settled);
    }

    // OpenFinance's `isInvoiced` flag has been observed marking transactions
    // as already-billed prematurely, within the still-open current cycle —
    // filtering on it undercounts (or otherwise misrepresents) what's really
    // pending by a wide margin compared to the issuer's own statement. The
    // "since the last billing date" window, computed from the billing day we
    // already know, tracks the issuer's real pending total far more closely,
    // so it's used unconditionally rather than only as a fallback.
    let pendingTx = card.transactions;
    const isEstimate = !dayOfMonthIsManual;
    let sinceDate: Date;
    if (dayOfMonth) {
      // A transaction dated on the billing day itself belongs to the
      // newly-opened cycle (it lands after that day's charge has already
      // gone out), so it's billed on the *next* occurrence of the billing
      // day — e.g. a purchase on Sep 15 with billing day 15 is charged Oct 15.
      sinceDate = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
      if (sinceDate.getTime() > now.getTime()) sinceDate.setMonth(sinceDate.getMonth() - 1);
    } else {
      sinceDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    pendingTx = card.transactions.filter((tx) => tx.date.getTime() >= sinceDate.getTime());

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
      displayName: card.displayName,
      entityId: card.entityId,
      entityName: card.entity?.name ?? null,
      currency: card.currency,
      pendingAmount,
      previousAmount,
      pendingCount: pendingTx.length,
      pendingSinceDate: toLocalDateString(sinceDate),
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
}
