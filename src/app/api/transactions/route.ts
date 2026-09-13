import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma, AccountType } from "@/generated/prisma";
import { matchCardForDescription, matchCardForAmount } from "@/lib/cardMatch";
import { computeCardForecasts } from "@/lib/cardForecast";

// GET /api/transactions?entity=<entityId>&category=Groceries&accountId=<id>
//   &accountType=credit_card&sign=expense&search=text&hideFuture=1&from=2026-01-01&to=2026-02-01
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const entityId = searchParams.get("entity");
  const category = searchParams.get("category");
  const accountId = searchParams.get("accountId");
  const accountType = searchParams.get("accountType");
  const sign = searchParams.get("sign"); // "income" | "expense"
  // "search" supersedes the older "merchant" param but both are honored.
  const search = searchParams.get("search") ?? searchParams.get("merchant");
  const hideFuture = searchParams.get("hideFuture") === "1";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const searchOr: Prisma.TransactionWhereInput[] | undefined = search
    ? [
        { description: { contains: search } },
        { note: { contains: search } },
        { category: { contains: search } },
        { additionalInfo: { contains: search } },
      ]
    : undefined;

  const transactions = await prisma.transaction.findMany({
    where: {
      accountMappingId: accountId ?? undefined,
      accountMapping: {
        entityId: entityId ?? undefined,
        accountType: accountType ? (accountType as AccountType) : undefined,
      },
      category: category ?? undefined,
      amount: sign === "income" ? { gt: 0 } : sign === "expense" ? { lt: 0 } : undefined,
      OR: searchOr,
      date: {
        gte: from ? new Date(from) : undefined,
        lte: hideFuture
          ? new Date()
          : to
          ? new Date(`${to}T23:59:59.999`)
          : undefined,
      },
    },
    include: {
      accountMapping: { include: { entity: true, mergedInto: true } },
      linkedCard: { select: { id: true, displayName: true, nickname: true } },
    },
    orderBy: { date: "desc" },
    take: 2000,
  });

  // A bank-account debit that's actually a credit card's monthly charge
  // (e.g. "לאומי מאסטרקארד") reads as an unexplained, unlabeled amount on
  // its own — tag it with the specific card it belongs to so it's traceable
  // back to the same card shown on the Forecast screen, even when several
  // cards share an issuer name and would otherwise look identical here. A
  // user-set link (Transaction.linkedCard) always wins — the bank's own
  // description frequently doesn't carry enough detail (no last-4 digits, a
  // generic issuer label shared by several of the user's cards) for the
  // heuristics below to tell cards apart on their own.
  const needsCardMatch = transactions.some((tx) => tx.accountMapping.accountType === "bank_account");
  const forecastCards = needsCardMatch ? await computeCardForecasts(null) : [];
  const textCandidates = forecastCards.map((c) => ({
    id: c.id,
    name: c.nickname ?? c.displayName,
    accountNumber: c.accountNumber,
    displayName: c.displayName,
  }));
  const amountCandidates = forecastCards.map((c) => ({
    id: c.id,
    name: c.nickname ?? c.displayName,
    entityId: c.entityId,
    isImmediateDebit: c.isImmediateDebit,
    dayOfMonth: c.dayOfMonth,
    chargeAmount: c.chargeAmount,
    previousAmount: c.previousAmount,
  }));

  const result = transactions.map((tx) => {
    if (tx.linkedCard) {
      return { ...tx, matchedCard: { id: tx.linkedCard.id, name: tx.linkedCard.nickname ?? tx.linkedCard.displayName, manual: true } };
    }
    if (tx.accountMapping.accountType !== "bank_account" || !needsCardMatch) {
      return { ...tx, matchedCard: null };
    }
    const entityId = tx.accountMapping.entityId;
    // The issuer name/last-4-digit heuristic is precise when the bank
    // actually includes that detail in the description — try it first, and
    // only fall back to matching by cycle amount (which several cards could
    // plausibly hit, hence the tolerance-based best match) when it doesn't.
    const textMatch = matchCardForDescription(
      tx.description,
      textCandidates.filter((c) => amountCandidates.find((a) => a.id === c.id)?.entityId === entityId)
    );
    const match = textMatch ?? matchCardForAmount({ entityId, date: tx.date, amount: tx.amount }, amountCandidates);
    return { ...tx, matchedCard: match ? { id: match.id, name: match.name, manual: false } : null };
  });

  return NextResponse.json(result);
}
