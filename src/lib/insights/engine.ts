import { prisma } from "@/lib/prisma";
import type { Locale } from "@/lib/i18n";
import { formatInsight } from "@/lib/insights/format";
import {
  addDays,
  differenceInCalendarDays,
  endOfWeek,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns";

// The rule-based "actionable insights" engine. No external AI calls — every
// rule below is plain arithmetic/heuristics over transactions already in the
// local Prisma database. Run via runInsightsEngine() from a sync route or the
// POST /api/insights/run endpoint; results are upserted into the Insight
// table keyed by (entityId, ruleKey) so re-runs update in place.
//
// Important limitation: the schema stores no opening/real-time account
// balance, only transactions (see the net-worth comment in
// src/app/api/dashboard/summary/route.ts). Rules that need a bank balance
// (weekly free cash, 60-day cashflow, idle cash) use the cumulative sum of
// all known transactions per account as a *proxy* balance. This is accurate
// for balance *movement* but only as accurate in absolute terms as how far
// back transaction history goes — it is labeled as an estimate everywhere
// it's surfaced.

const ILS = "ILS";

export interface InsightDraft {
  ruleKey: string;
  type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  actionText?: string;
  amount?: number;
  metadata?: Record<string, unknown>;
}

interface Tx {
  id: string;
  date: Date;
  amount: number;
  description: string;
  merchantNormalized: string | null;
  category: string | null;
  accountMappingId: string;
  isInvoiced: boolean | null;
}

function merchantKey(tx: Tx) {
  return (tx.merchantNormalized ?? tx.description).trim().toLowerCase();
}

function median(nums: number[]) {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(nums: number[]) {
  return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
}

// Same cadence-regularity heuristic as /api/dashboard/subscriptions, kept in
// sync deliberately rather than imported, since that route may evolve its
// own display-only tweaks independently of what the engine needs.
const CADENCE_BANDS: { name: string; min: number; max: number }[] = [
  { name: "weekly", min: 5, max: 9 },
  { name: "biweekly", min: 12, max: 16 },
  { name: "monthly", min: 25, max: 35 },
  { name: "bimonthly", min: 55, max: 65 },
  { name: "quarterly", min: 85, max: 97 },
  { name: "yearly", min: 350, max: 380 },
];

function detectCadence(dates: Date[]): { isRecurring: boolean; cadence: string | null; avgDays: number | null } {
  if (dates.length < 3) return { isRecurring: false, cadence: null, avgDays: null };
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) intervals.push((sorted[i].getTime() - sorted[i - 1].getTime()) / 86_400_000);
  const med = median(intervals);
  const band = CADENCE_BANDS.find((b) => med >= b.min && med <= b.max);
  if (!band) return { isRecurring: false, cadence: null, avgDays: null };
  const m = mean(intervals);
  const variance = mean(intervals.map((n) => (n - m) ** 2));
  const cv = m > 0 ? Math.sqrt(variance) / m : Infinity;
  return { isRecurring: cv < 0.4, cadence: band.name, avgDays: m };
}

// Statutory/government payments (tax, national insurance, VAT) are picked up
// by the recurring-cadence detector but aren't a "vendor" a customer can
// negotiate with or cancel — suggesting otherwise is actively wrong, so both
// the price-creep and duplicate-subscription rules exclude them.
const NON_NEGOTIABLE_KEYWORDS = ["מס הכנסה", "ביטוח לאומי", "מע\"מ", "מעמ", "רשות המסים", "מדינת ישראל", "שע\"מ", "ארנונה"];
function isNonNegotiable(merchant: string) {
  return NON_NEGOTIABLE_KEYWORDS.some((k) => merchant.includes(k));
}

function groupByMerchant(transactions: Tx[]) {
  const groups = new Map<string, Tx[]>();
  for (const tx of transactions) {
    if (tx.amount >= 0) continue;
    const key = merchantKey(tx);
    if (!key || isNonNegotiable(key)) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tx);
  }
  return groups;
}

// --- Rule 1: silent price creep on recurring charges -----------------------
// Flags a recurring merchant whose latest charge rose >=10% or >=20 ILS
// versus the average of the up-to-3 charges before it.
function rulePriceCreep(transactions: Tx[]): InsightDraft[] {
  const drafts: InsightDraft[] = [];
  const groups = groupByMerchant(transactions);
  for (const [merchant, occ] of groups) {
    const sorted = [...occ].sort((a, b) => a.date.getTime() - b.date.getTime());
    const { isRecurring } = detectCadence(sorted.map((o) => o.date));
    if (!isRecurring || sorted.length < 4) continue;

    const last = sorted[sorted.length - 1];
    const priorWindow = sorted.slice(-4, -1); // up to 3 charges before the last one
    const priorAvg = mean(priorWindow.map((o) => Math.abs(o.amount)));
    if (priorAvg <= 0) continue;
    const lastAmt = Math.abs(last.amount);
    const deltaAbs = lastAmt - priorAvg;
    const deltaPct = deltaAbs / priorAvg;
    if (deltaPct >= 0.1 || deltaAbs >= 20) {
      const displayName = (last.description || merchant).trim();
      const actionText =
        `שלום, שמתי לב שהחיוב האחרון שלכם עבור "${displayName}" עמד על ${lastAmt.toFixed(2)} ש"ח, ` +
        `לעומת ממוצע של ${priorAvg.toFixed(2)} ש"ח בחודשים הקודמים — עלייה של ${(deltaPct * 100).toFixed(0)}%. ` +
        `אשמח לקבל הבהרה סביב הסיבה לעלייה, ואם ניתן לחזור למחיר הקודם או לבטל את המנוי. תודה.`;
      drafts.push({
        ruleKey: `price_creep:${merchant}`,
        type: "price_creep",
        severity: "warning",
        title: `התייקרות שקטה: ${displayName}`,
        message: `החיוב האחרון (${lastAmt.toFixed(0)} ש"ח) גבוה ב-${(deltaPct * 100).toFixed(0)}% (${deltaAbs.toFixed(0)} ש"ח) מהממוצע של 3 החיובים הקודמים (${priorAvg.toFixed(0)} ש"ח).`,
        actionText,
        amount: deltaAbs,
        metadata: { merchant: displayName, lastAmount: lastAmt, priorAvg, deltaPct },
      });
    }
  }
  return drafts;
}

// --- Rule 2: duplicate/dead subscription hunter -----------------------------
const STREAMING_KEYWORDS = ["netflix", "disney", "hbo", "yes", "cellcom tv", "amazon prime", "spotify", "apple music", "youtube premium", "youtube music"];
const GYM_KEYWORDS = ["הולמס פלייס", "holmes place", "פיטנס", "מכון כושר", "gym", "fitness"];
const CATEGORY_GROUPS_FOR_DUPES: { label: string; keywords: string[] }[] = [
  { label: "סטרימינג/מוזיקה", keywords: STREAMING_KEYWORDS },
  { label: "חדר כושר", keywords: GYM_KEYWORDS },
];

function ruleDuplicateSubscriptions(transactions: Tx[], now: Date): InsightDraft[] {
  const twelveMonthsAgo = subMonths(now, 12);
  const recent = transactions.filter((t) => t.date >= twelveMonthsAgo);
  const groups = groupByMerchant(recent);

  const recurringMerchants: { merchant: string; monthlyEquivalent: number; lastDate: Date; cadence: string | null; firstAmount: number; lastAmount: number }[] = [];
  for (const [merchant, occ] of groups) {
    const sorted = [...occ].sort((a, b) => a.date.getTime() - b.date.getTime());
    const { isRecurring, cadence } = detectCadence(sorted.map((o) => o.date));
    if (!isRecurring) continue;
    const lastAmount = Math.abs(sorted[sorted.length - 1].amount);
    const firstAmount = Math.abs(sorted[0].amount);
    const cadenceMonths = cadence === "weekly" ? 0.25 : cadence === "biweekly" ? 0.5 : cadence === "monthly" ? 1 : cadence === "bimonthly" ? 2 : cadence === "quarterly" ? 3 : 12;
    recurringMerchants.push({
      merchant,
      monthlyEquivalent: lastAmount / cadenceMonths,
      lastDate: sorted[sorted.length - 1].date,
      cadence,
      firstAmount,
      lastAmount,
    });
  }

  const drafts: InsightDraft[] = [];

  // 2a. Overlapping services in the same category (e.g. two streaming subs).
  for (const group of CATEGORY_GROUPS_FOR_DUPES) {
    const matches = recurringMerchants.filter((m) => group.keywords.some((k) => m.merchant.includes(k)));
    if (matches.length >= 2) {
      matches.sort((a, b) => b.monthlyEquivalent - a.monthlyEquivalent);
      const keepCheapest = matches[matches.length - 1];
      const redundant = matches.filter((m) => m !== keepCheapest);
      const annualSavings = redundant.reduce((s, m) => s + m.monthlyEquivalent * 12, 0);
      drafts.push({
        ruleKey: `duplicate_category:${group.label}`,
        type: "duplicate_subscriptions",
        severity: "info",
        title: `מנויים כפולים בקטגוריית ${group.label}`,
        message: `נמצאו ${matches.length} מנויים פעילים בקטגוריית ${group.label}: ${matches.map((m) => m.merchant).join(", ")}. איחוד וביטול הכפולים יכול לחסוך כ-${Math.round(annualSavings).toLocaleString()} ש"ח בשנה.`,
        actionText: `שקול/י לבטל: ${redundant.map((m) => m.merchant).join(", ")} ולהשאיר את ${keepCheapest.merchant}.`,
        amount: annualSavings,
        metadata: {
          category: group.label,
          merchants: matches.map((m) => m.merchant),
          annualSavings,
          cheapestMerchant: keepCheapest.merchant,
          redundantMerchants: redundant.map((m) => m.merchant),
        },
      });
    }
  }

  // 2b. Subscriptions whose price crept up a lot since their first charge
  // (12-month window) — a proxy for "worth reconsidering", since the
  // dataset has no usage signal to detect a truly unused subscription.
  for (const m of recurringMerchants) {
    if (m.firstAmount <= 0) continue;
    const totalGrowth = (m.lastAmount - m.firstAmount) / m.firstAmount;
    if (totalGrowth >= 0.25 && m.lastAmount >= 15) {
      const cadenceMonths = m.cadence === "weekly" ? 0.25 : m.cadence === "biweekly" ? 0.5 : m.cadence === "monthly" ? 1 : m.cadence === "bimonthly" ? 2 : m.cadence === "quarterly" ? 3 : 12;
      const annualSavings = m.lastAmount * (12 / cadenceMonths);
      drafts.push({
        ruleKey: `creeping_subscription:${m.merchant}`,
        type: "duplicate_subscriptions",
        severity: "info",
        title: `מנוי שהתייקר משמעותית: ${m.merchant}`,
        message: `המחיר עלה ${(totalGrowth * 100).toFixed(0)}% מאז החיוב הראשון שנרשם (${m.firstAmount.toFixed(0)} ← ${m.lastAmount.toFixed(0)} ש"ח). כדאי לבדוק אם עדיין משתמשים בשירות; ביטול יחסוך כ-${Math.round(annualSavings).toLocaleString()} ש"ח בשנה.`,
        amount: annualSavings,
        metadata: { merchant: m.merchant, firstAmount: m.firstAmount, lastAmount: m.lastAmount, annualSavings },
      });
    }
  }

  return drafts;
}

// --- Rule 3: weekly "free money" gauge (Riseup-style) -----------------------
function ruleWeeklyFreeCash(transactions: Tx[], now: Date): InsightDraft[] {
  const threeMonthsAgo = subMonths(now, 3);
  const window = transactions.filter((t) => t.date >= threeMonthsAgo && t.date < now);

  const recurringMerchantKeys = new Set(
    [...groupByMerchant(window).entries()]
      .filter(([, occ]) => detectCadence(occ.map((o) => o.date)).isRecurring)
      .map(([k]) => k)
  );

  // Discretionary = expenses that aren't a detected recurring subscription.
  const discretionary = window.filter((t) => t.amount < 0 && !recurringMerchantKeys.has(merchantKey(t)));
  const weeksInWindow = Math.max(1, differenceInCalendarDays(now, threeMonthsAgo) / 7);
  const avgWeeklyDiscretionary = discretionary.reduce((s, t) => s + Math.abs(t.amount), 0) / weeksInWindow;

  const weekStart = startOfWeek(now, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 0 });
  const thisWeekTx = transactions.filter((t) => t.date >= weekStart && t.date <= now);
  const spentThisWeek = thisWeekTx
    .filter((t) => t.amount < 0 && !recurringMerchantKeys.has(merchantKey(t)))
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  const freeRemaining = avgWeeklyDiscretionary - spentThisWeek;
  const dayOfWeek = differenceInCalendarDays(now, weekStart) + 1; // 1..7
  const expectedPaceSpend = avgWeeklyDiscretionary * (dayOfWeek / 7);
  const overPace = spentThisWeek - expectedPaceSpend;

  const drafts: InsightDraft[] = [];
  // No meaningful trailing spend to gauge a budget against — skip rather
  // than show a hollow "0 of 0" card for a brand-new/inactive entity.
  if (avgWeeklyDiscretionary <= 0) return drafts;
  const severity: InsightDraft["severity"] = freeRemaining < 0 ? "critical" : overPace > avgWeeklyDiscretionary * 0.15 ? "warning" : "info";

  let recommendation = "";
  let topCategoryLabel: string | undefined;
  let topCategoryAmount: number | undefined;
  let dailyCutSuggestion: number | undefined;
  if (overPace > avgWeeklyDiscretionary * 0.1) {
    const byCategory = new Map<string, number>();
    for (const t of thisWeekTx) {
      if (t.amount >= 0 || recurringMerchantKeys.has(merchantKey(t))) continue;
      const cat = t.category ?? "לא מסווג";
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + Math.abs(t.amount));
    }
    const topCategory = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
    const daysLeft = Math.max(1, 7 - dayOfWeek);
    if (topCategory) {
      topCategoryLabel = topCategory[0];
      topCategoryAmount = topCategory[1];
      dailyCutSuggestion = Math.max(0, overPace) / daysLeft;
      recommendation = ` הקטגוריה המובילה השבוע היא "${topCategoryLabel}" (${Math.round(topCategoryAmount)} ש"ח) — כדאי לצמצם בה כ-${Math.round(dailyCutSuggestion)} ש"ח ליום עד סוף השבוע כדי לחזור לקצב.`;
    }
  }

  drafts.push({
    ruleKey: "weekly_free_cash",
    type: "weekly_free_cash",
    severity,
    title: "הסכום הפנוי לשבוע",
    message:
      `נשארו כ-${Math.round(Math.max(0, freeRemaining)).toLocaleString()} ש"ח לבזבוזים חופשיים השבוע ` +
      `(מתוך תקציב שבועי ממוצע של ${Math.round(avgWeeklyDiscretionary).toLocaleString()} ש"ח, מזה ${Math.round(spentThisWeek).toLocaleString()} ש"ח כבר הוצא).` +
      (freeRemaining < 0 ? " חרגתם מהתקציב השבועי." : "") +
      recommendation,
    amount: freeRemaining,
    metadata: {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      avgWeeklyDiscretionary,
      spentThisWeek,
      overPace,
      topCategory: topCategoryLabel,
      topCategoryAmount,
      dailyCutSuggestion,
    },
  });
  return drafts;
}

// --- Rule 4: 60-day cashflow forecast ---------------------------------------
async function ruleCashflowForecast(entityId: string | null, now: Date): Promise<InsightDraft[]> {
  const bankAccounts = await prisma.accountMapping.findMany({
    where: { accountType: "bank_account", mergedIntoId: null, ...(entityId ? { entityId } : {}) },
    include: { transactions: true },
  });

  const drafts: InsightDraft[] = [];
  const sixMonthsAgo = subMonths(now, 6);

  for (const account of bankAccounts) {
    if (account.transactions.length === 0) continue;
    // Proxy balance: cumulative sum of all known transactions on this
    // account (see the module-level note on the balance limitation).
    const currentBalance = account.transactions.reduce((s, t) => s + t.amount, 0);

    const history = account.transactions.filter((t) => t.date >= sixMonthsAgo);
    const incomeTx = history.filter((t) => t.amount > 0);
    const expenseTx = history.filter((t) => t.amount < 0);

    const weeksOfHistory = Math.max(1, differenceInCalendarDays(now, sixMonthsAgo) / 7);
    const avgWeeklyIncome = incomeTx.reduce((s, t) => s + t.amount, 0) / weeksOfHistory;
    const avgWeeklyExpense = Math.abs(expenseTx.reduce((s, t) => s + t.amount, 0)) / weeksOfHistory;

    let projected = currentBalance;
    let firstNegativeWeek: { weekStart: Date; balance: number } | null = null;
    for (let w = 1; w <= 9; w++) {
      // ~9 weeks covers the requested 60-day horizon.
      const weekStart = addDays(now, (w - 1) * 7);
      projected += avgWeeklyIncome - avgWeeklyExpense;
      if (projected < 0 && !firstNegativeWeek) {
        firstNegativeWeek = { weekStart, balance: projected };
      }
    }

    if (firstNegativeWeek) {
      drafts.push({
        ruleKey: `cashflow_risk:${account.id}`,
        type: "cashflow_risk",
        severity: "critical",
        title: `סיכון ליתרת שלילית: ${account.nickname ?? account.displayName}`,
        message:
          `לפי תזרים ההכנסות וההוצאות הממוצע (6 חודשים אחרונים), היתרה המוערכת בחשבון "${account.nickname ?? account.displayName}" ` +
          `צפויה לרדת מתחת לאפס סביב שבוע ${firstNegativeWeek.weekStart.toLocaleDateString("he-IL")} (יתרה מוערכת: ${Math.round(firstNegativeWeek.balance).toLocaleString()} ש"ח). ` +
          `היתרה הנוכחית המוערכת (מבוססת על היסטוריית התנועות בלבד) היא ${Math.round(currentBalance).toLocaleString()} ש"ח.`,
        amount: firstNegativeWeek.balance,
        metadata: {
          accountId: account.id,
          accountName: account.nickname ?? account.displayName,
          currentBalanceEstimate: currentBalance,
          avgWeeklyIncome,
          avgWeeklyExpense,
          projectedNegativeWeek: firstNegativeWeek.weekStart.toISOString(),
          projectedBalance: firstNegativeWeek.balance,
        },
      });
    }
  }
  return drafts;
}

// --- Rule 5: cross-entity cash & IBKR/owner-injection optimization ---------
const BUSINESS_HINT = /עסק|business|בע["׳]?מ|company/i;
const PERSONAL_HINT = /פרטי|personal/i;

async function ruleCashOptimization(entities: { id: string; name: string }[], now: Date): Promise<InsightDraft[]> {
  const threeMonthsAgo = subMonths(now, 3);
  const drafts: InsightDraft[] = [];

  const balances: { entityId: string; entityName: string; balance: number; movement3mo: number; hasInvestments: boolean }[] = [];

  for (const entity of entities) {
    const bankAccounts = await prisma.accountMapping.findMany({
      where: { entityId: entity.id, accountType: "bank_account", mergedIntoId: null },
      include: { transactions: true },
    });
    if (bankAccounts.length === 0) continue;

    let totalBalance = 0;
    let movement3mo = 0;
    for (const account of bankAccounts) {
      totalBalance += account.transactions.reduce((s, t) => s + t.amount, 0);
      movement3mo += account.transactions
        .filter((t) => t.date >= threeMonthsAgo)
        .reduce((s, t) => s + Math.abs(t.amount), 0);
    }
    const investmentCount = await prisma.accountMapping.count({
      where: { entityId: entity.id, source: { in: ["ibkr", "fair"] } },
    });
    balances.push({ entityId: entity.id, entityName: entity.name, balance: totalBalance, movement3mo, hasInvestments: investmentCount > 0 });

    // Idle cash: healthy positive balance, but little net movement relative
    // to its size over the last 3 months (proxy for "just sitting there").
    const IDLE_BALANCE_THRESHOLD = 20_000;
    if (totalBalance > IDLE_BALANCE_THRESHOLD && movement3mo < totalBalance * 0.3) {
      drafts.push({
        ruleKey: `idle_cash:${entity.id}`,
        type: "idle_cash",
        severity: "info",
        title: `עודף מזומן לא פעיל — ${entity.name}`,
        message:
          `בישות "${entity.name}" יש יתרת עו"ש מוערכת של כ-${Math.round(totalBalance).toLocaleString()} ש"ח ` +
          `עם תנועה מועטה יחסית ב-3 החודשים האחרונים (כ-${Math.round(movement3mo).toLocaleString()} ש"ח). ` +
          `שקול/י להעביר חלק מהסכום לתיק ההשקעות (IBKR) או לפיקדון/קרן כספית מניבה, ולהשאיר כרית נזילות סבירה בעו"ש.`,
        amount: totalBalance,
        metadata: { entityId: entity.id, entityName: entity.name, balance: totalBalance, movement3mo },
      });
    }
  }

  // Business owner-injection check: find an entity that looks like the
  // business (by name) and one that looks like the personal entity, and flag
  // if the business is running a deficit while the personal entity has a
  // comfortable surplus.
  const business = balances.find((b) => BUSINESS_HINT.test(b.entityName) || BUSINESS_HINT.test(b.entityId));
  const personal = balances.find(
    (b) => b !== business && (PERSONAL_HINT.test(b.entityName) || PERSONAL_HINT.test(b.entityId))
  );
  if (business && personal) {
    const PERSONAL_BUFFER = 15_000;
    if (business.balance < 0 && personal.balance - PERSONAL_BUFFER > 0) {
      const suggestedTransfer = Math.min(personal.balance - PERSONAL_BUFFER, Math.abs(business.balance) * 1.1);
      if (suggestedTransfer > 0) {
        drafts.push({
          ruleKey: "owner_injection",
          type: "owner_injection",
          severity: "warning",
          title: "מומלץ להזרים הון בעלים לעסק",
          message:
            `יתרת החשבון העסקי מוערכת בגירעון של כ-${Math.round(Math.abs(business.balance)).toLocaleString()} ש"ח, ` +
            `בעוד שבחשבון הפרטי יש עודף מעל לכרית הביטחון (${PERSONAL_BUFFER.toLocaleString()} ש"ח). ` +
            `הזרמת בעלים מוצעת בסך כ-${Math.round(suggestedTransfer).toLocaleString()} ש"ח יכולה למנוע ריבית/עמלות גישור על החשבון העסקי.`,
          amount: suggestedTransfer,
          metadata: {
            businessEntityId: business.entityId,
            personalEntityId: personal.entityId,
            suggestedTransfer,
            businessBalance: business.balance,
            personalBuffer: PERSONAL_BUFFER,
          },
        });
      }
    }
  }

  return drafts;
}

// --- Orchestration -----------------------------------------------------------

async function upsertInsights(entityId: string | null, drafts: InsightDraft[]) {
  const keepKeys = new Set(drafts.map((d) => d.ruleKey));
  // Prisma's generated compound-unique input for (entityId, ruleKey) doesn't
  // accept null for entityId, so global (cross-entity) insights are upserted
  // by hand instead of via `upsert`'s where clause.
  for (const draft of drafts) {
    const existing = await prisma.insight.findFirst({ where: { entityId, ruleKey: draft.ruleKey } });
    const data = {
      type: draft.type,
      severity: draft.severity,
      title: draft.title,
      message: draft.message,
      actionText: draft.actionText ?? null,
      amount: draft.amount ?? null,
      metadata: draft.metadata ? JSON.stringify(draft.metadata) : null,
    };
    if (existing) {
      await prisma.insight.update({ where: { id: existing.id }, data: { ...data, computedAt: new Date() } });
    } else {
      await prisma.insight.create({ data: { ...data, entityId, ruleKey: draft.ruleKey } });
    }
  }
  // Drop stale insights this run no longer produced, but leave user
  // dismissals alone for keys that are still being generated (upsert above
  // does not touch `dismissed`).
  await prisma.insight.deleteMany({
    where: { entityId, ruleKey: { notIn: [...keepKeys] } },
  });
}

export async function runInsightsEngine(): Promise<{ entities: number; generated: number }> {
  const entities = await prisma.entity.findMany();
  const now = new Date();
  let generated = 0;

  for (const entity of entities) {
    const accounts = await prisma.accountMapping.findMany({
      where: { entityId: entity.id, accountType: "credit_card" },
      select: { id: true },
    });
    const cardIds = new Set(accounts.map((a) => a.id));

    const transactions = (await prisma.transaction.findMany({
      where: { accountMapping: { entityId: entity.id } },
      orderBy: { date: "asc" },
    })) as Tx[];

    const cardTransactions = transactions.filter((t) => cardIds.has(t.accountMappingId));

    const drafts: InsightDraft[] = [
      ...rulePriceCreep(cardTransactions.length ? cardTransactions : transactions),
      ...ruleDuplicateSubscriptions(cardTransactions.length ? cardTransactions : transactions, now),
      ...ruleWeeklyFreeCash(transactions, now),
      ...(await ruleCashflowForecast(entity.id, now)),
    ];

    await upsertInsights(entity.id, drafts);
    generated += drafts.length;
  }

  const globalDrafts = await ruleCashOptimization(entities.map((e) => ({ id: e.id, name: e.name })), now);
  await upsertInsights(null, globalDrafts);
  generated += globalDrafts.length;

  return { entities: entities.length, generated };
}

export interface WeeklyDigestData {
  entityName: string;
  balances: { label: string; amount: number; currency: string }[];
  topExpenses: { description: string; amount: number; category: string | null }[];
  highlight: string | null;
}

// Builds the data behind the weekly plain-text digest (see
// GET /api/insights/digest). Kept separate from the text formatting so the
// UI could, in principle, render it as a card instead of copy-pasted text.
export async function buildWeeklyDigest(entityId: string, now = new Date(), locale: Locale = "he"): Promise<WeeklyDigestData> {
  const entity = await prisma.entity.findUniqueOrThrow({ where: { id: entityId } });
  const weekStart = startOfWeek(now, { weekStartsOn: 0 });

  const bankAccounts = await prisma.accountMapping.findMany({
    where: { entityId, accountType: "bank_account", mergedIntoId: null },
    include: { transactions: true },
  });
  const balances = bankAccounts.map((a) => ({
    label: a.nickname ?? a.displayName,
    amount: a.transactions.reduce((s, t) => s + t.amount, 0),
    currency: a.currency,
  }));

  const weekTx = await prisma.transaction.findMany({
    where: { accountMapping: { entityId }, date: { gte: weekStart, lte: now }, amount: { lt: 0 } },
    orderBy: { amount: "asc" },
    take: 3,
  });
  const topExpenses = weekTx.map((t) => ({ description: t.description, amount: Math.abs(t.amount), category: t.category }));

  // Highlight: reuse the top-ranked, still-open insight for this entity if
  // one exists (already the most "actionable" thing the engine found).
  const topInsight = await prisma.insight.findFirst({
    where: { entityId, dismissed: false },
    orderBy: [{ severity: "desc" }, { computedAt: "desc" }],
  });

  const highlight = topInsight
    ? formatInsight(
        {
          ruleKey: topInsight.ruleKey,
          type: topInsight.type,
          title: topInsight.title,
          message: topInsight.message,
          actionText: topInsight.actionText,
          metadata: topInsight.metadata ? JSON.parse(topInsight.metadata) : null,
        },
        locale
      ).message
    : null;

  return {
    entityName: entity.name,
    balances,
    topExpenses,
    highlight,
  };
}

export function formatWeeklyDigestText(data: WeeklyDigestData, now = new Date(), locale: Locale = "he"): string {
  if (locale === "en") {
    const dateLabel = now.toLocaleDateString("en-US", { day: "numeric", month: "short" });
    const lines: string[] = [];
    lines.push(`Weekly summary — ${data.entityName} (${dateLabel})`);
    lines.push("");
    if (data.balances.length) {
      lines.push("Account balances:");
      for (const b of data.balances) lines.push(`• ${b.label}: ${Math.round(b.amount).toLocaleString()} ${b.currency}`);
      lines.push("");
    }
    if (data.topExpenses.length) {
      lines.push("Top 3 expenses this week:");
      for (const e of data.topExpenses) lines.push(`• ${e.description} — ₪${Math.round(e.amount).toLocaleString()}${e.category ? ` (${e.category})` : ""}`);
      lines.push("");
    }
    if (data.highlight) {
      lines.push(`💡 ${data.highlight}`);
    }
    return lines.join("\n");
  }

  const dateLabel = now.toLocaleDateString("he-IL", { day: "numeric", month: "short" });
  const lines: string[] = [];
  lines.push(`סיכום שבועי — ${data.entityName} (${dateLabel})`);
  lines.push("");
  if (data.balances.length) {
    lines.push("יתרות חשבון:");
    for (const b of data.balances) lines.push(`• ${b.label}: ${Math.round(b.amount).toLocaleString()} ${b.currency}`);
    lines.push("");
  }
  if (data.topExpenses.length) {
    lines.push("3 ההוצאות הגדולות השבוע:");
    for (const e of data.topExpenses) lines.push(`• ${e.description} — ${Math.round(e.amount).toLocaleString()} ש"ח${e.category ? ` (${e.category})` : ""}`);
    lines.push("");
  }
  if (data.highlight) {
    lines.push(`💡 ${data.highlight}`);
  }
  return lines.join("\n");
}

// Re-exported for callers that want "since N days ago" without importing
// date-fns directly (kept minimal — not a general utility module).
export function daysAgo(n: number, from = new Date()) {
  return subDays(from, n);
}
