import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startOfMonth, subMonths } from "date-fns";

// GET /api/dashboard/summary?entity=<entityId>&months=6
// Returns monthly income/expense totals, category breakdown, and net worth
// (ILS bank/card balances derived from transactions + USD IBKR/Fair positions,
// kept separate rather than force-converted).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const entityId = searchParams.get("entity");
  const months = Number(searchParams.get("months") ?? 6);
  const since = startOfMonth(subMonths(new Date(), months - 1));

  const where = entityId ? { accountMapping: { entityId } } : {};

  const transactions = await prisma.transaction.findMany({
    where: { ...where, date: { gte: since } },
    include: { accountMapping: true },
  });

  const monthly: Record<string, { income: number; expense: number }> = {};
  const byCategory: Record<string, number> = {};

  for (const tx of transactions) {
    const key = startOfMonth(tx.date).toISOString().slice(0, 7);
    if (!monthly[key]) monthly[key] = { income: 0, expense: 0 };
    if (tx.amount >= 0) monthly[key].income += tx.amount;
    else monthly[key].expense += Math.abs(tx.amount);

    if (tx.amount < 0) {
      const cat = tx.category ?? "Uncategorized";
      byCategory[cat] = (byCategory[cat] ?? 0) + Math.abs(tx.amount);
    }
  }

  // Roll category totals up into their CategoryGroup (e.g. Groceries +
  // Electricity + Water -> "Home Maintenance"), for users who've grouped
  // their categories. Ungrouped/unknown categories fall back to their own name.
  const categoryRows = await prisma.category.findMany({ include: { group: true } });
  const groupByCategory = new Map(categoryRows.map((c) => [c.name, c.group?.name ?? null]));
  const byCategoryGroup: Record<string, number> = {};
  for (const [cat, amount] of Object.entries(byCategory)) {
    const groupName = groupByCategory.get(cat) ?? cat;
    byCategoryGroup[groupName] = (byCategoryGroup[groupName] ?? 0) + amount;
  }

  // Net worth: latest cash balance approximation from ILS transactions'
  // running total is out of scope without opening balances, so we surface
  // USD investment value (IBKR positions + cash) and Fair portfolio value
  // separately, per currency, without forced conversion.
  const ibkrMappings = await prisma.accountMapping.findMany({
    where: { source: "ibkr", ...(entityId ? { entityId } : {}) },
    include: {
      ibkrPositions: { orderBy: { asOfDate: "desc" } },
      ibkrCashLines: { orderBy: { asOfDate: "desc" } },
    },
  });

  let usdPositionsValue = 0;
  let usdCash = 0;
  for (const m of ibkrMappings) {
    const latestDate = m.ibkrPositions[0]?.asOfDate;
    if (latestDate) {
      usdPositionsValue += m.ibkrPositions
        .filter((p) => p.asOfDate.getTime() === latestDate.getTime())
        .reduce((sum, p) => sum + p.positionValue, 0);
    }
    const usdCashLine = m.ibkrCashLines.find((c) => c.currency === "USD");
    if (usdCashLine) usdCash += usdCashLine.endingCash;
  }

  const fairMappings = await prisma.accountMapping.findMany({
    where: { source: "fair", ...(entityId ? { entityId } : {}) },
    include: { portfolioSnaps: { orderBy: { asOfDate: "desc" }, take: 1 } },
  });
  const ilsPortfolioValue = fairMappings.reduce(
    (sum, m) => sum + (m.portfolioSnaps[0]?.totalValue ?? 0),
    0
  );

  // --- Insights ---------------------------------------------------------
  const monthKeys = Object.keys(monthly).sort();
  const currentKey = monthKeys[monthKeys.length - 1];
  const prevKey = monthKeys[monthKeys.length - 2];
  const current = currentKey ? monthly[currentKey] : { income: 0, expense: 0 };
  const previous = prevKey ? monthly[prevKey] : null;
  const expenseChangePct =
    previous && previous.expense > 0 ? (current.expense - previous.expense) / previous.expense : null;
  const incomeChangePct =
    previous && previous.income > 0 ? (current.income - previous.income) / previous.income : null;

  const currentMonthTx = currentKey
    ? transactions.filter((tx) => startOfMonth(tx.date).toISOString().slice(0, 7) === currentKey)
    : [];

  const merchantTotals = new Map<string, { amount: number; count: number; category: string | null }>();
  for (const tx of currentMonthTx) {
    if (tx.amount >= 0) continue;
    const key = (tx.merchantNormalized ?? tx.description).trim() || "(unknown)";
    const cur = merchantTotals.get(key) ?? { amount: 0, count: 0, category: tx.category };
    cur.amount += Math.abs(tx.amount);
    cur.count += 1;
    merchantTotals.set(key, cur);
  }
  const topMerchants = [...merchantTotals.entries()]
    .map(([merchant, v]) => ({ merchant, ...v }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  const biggestTransactions = currentMonthTx
    .filter((tx) => tx.amount < 0)
    .sort((a, b) => a.amount - b.amount)
    .slice(0, 5)
    .map((tx) => ({
      id: tx.id,
      date: tx.date.toISOString(),
      description: tx.description,
      amount: Math.abs(tx.amount),
      category: tx.category,
    }));

  const daysElapsedThisMonth = currentKey === new Date().toISOString().slice(0, 7)
    ? new Date().getDate()
    : 30;
  const avgDailyExpense = current.expense / Math.max(1, daysElapsedThisMonth);
  const savingsRate = current.income > 0 ? (current.income - current.expense) / current.income : null;

  // --- Credit cards -------------------------------------------------------
  // "Predicted next charge" is a sum of card charges OpenFinance has already
  // posted but flagged as not yet billed (isInvoiced: false) — it reflects
  // real pending charges, not a forecast, and is only as complete as what
  // the bank has posted so far this cycle.
  const cardMappings = await prisma.accountMapping.findMany({
    where: { accountType: "credit_card", ...(entityId ? { entityId } : {}) },
  });
  const cardIds = new Set(cardMappings.map((c) => c.id));
  const cardTx = transactions.filter((tx) => cardIds.has(tx.accountMappingId) && tx.amount < 0);

  const cardSpendThisMonth = currentMonthTx
    .filter((tx) => cardIds.has(tx.accountMappingId) && tx.amount < 0)
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const cardSpendTotal = cardTx.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const predictedNextCharge = cardTx
    .filter((tx) => tx.isInvoiced === false)
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const hasInvoicedData = cardTx.some((tx) => tx.isInvoiced !== null);

  return NextResponse.json({
    monthly,
    byCategory,
    byCategoryGroup,
    cards: {
      spendThisMonth: cardSpendThisMonth,
      spendTotal: cardSpendTotal,
      predictedNextCharge: hasInvoicedData ? predictedNextCharge : null,
    },
    netWorth: {
      usd: { positions: usdPositionsValue, cash: usdCash, total: usdPositionsValue + usdCash },
      ils: { portfolio: ilsPortfolioValue },
    },
    insights: {
      expenseChangePct,
      incomeChangePct,
      topMerchants,
      biggestTransactions,
      avgDailyExpense,
      savingsRate,
    },
  });
}
