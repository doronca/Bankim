import { prisma } from "@/lib/prisma";
import { startOfMonth, subMonths } from "date-fns";
import { learnAndApplyRule } from "@/lib/categorize/engine";

// A small rule-based command interpreter — NOT an LLM. It recognizes a fixed
// set of English/Hebrew phrasings for the two things useful inside a local
// finance dashboard: asking simple spend questions, and setting
// categorization rules by talking instead of clicking. Anything it doesn't
// recognize gets a help message listing what it understands.

export interface AssistantResult {
  reply: string;
  data?: unknown;
}

interface Ctx {
  entityId: string | null;
}

function monthRange(offset: number) {
  const start = startOfMonth(subMonths(new Date(), offset));
  const end = startOfMonth(subMonths(new Date(), offset - 1));
  return { start, end };
}

async function spendOnCategory(category: string, ctx: Ctx, monthsAgo: number) {
  const { start, end } = monthRange(monthsAgo);
  const rows = await prisma.transaction.findMany({
    where: {
      amount: { lt: 0 },
      date: { gte: start, lt: end },
      accountMapping: ctx.entityId ? { entityId: ctx.entityId } : undefined,
    },
  });
  const needle = category.trim().toLowerCase();
  const matched = rows.filter((r) => (r.category ?? "").toLowerCase() === needle);
  const total = matched.reduce((sum, r) => sum + Math.abs(r.amount), 0);
  return { total, count: matched.length };
}

async function topMerchants(ctx: Ctx, monthsAgo: number, limit = 5) {
  const { start, end } = monthRange(monthsAgo);
  const rows = await prisma.transaction.findMany({
    where: {
      amount: { lt: 0 },
      date: { gte: start, lt: end },
      accountMapping: ctx.entityId ? { entityId: ctx.entityId } : undefined,
    },
  });
  const totals = new Map<string, number>();
  for (const r of rows) {
    const key = (r.merchantNormalized ?? r.description).trim() || "(unknown)";
    totals.set(key, (totals.get(key) ?? 0) + Math.abs(r.amount));
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

const HELP_EN = [
  "I understand a fixed set of commands (I'm rule-based, not an AI):",
  "• \"categorize <merchant> as <category>\" — creates a rule, same as recategorizing in the table",
  "• \"how much did I spend on <category>\" / \"... last month\"",
  "• \"top merchants\" / \"top merchants last month\"",
  "• \"top categories\"",
].join("\n");

const HELP_HE = [
  "אני מבין קבוצה קבועה של פקודות (מבוסס חוקים, לא בינה מלאכותית):",
  "• \"קטלג את <בית עסק> כ<קטגוריה>\" — יוצר כלל, כמו שינוי קטגוריה בטבלה",
  "• \"כמה הוצאתי על <קטגוריה>\" / \"...בחודש שעבר\"",
  "• \"בתי עסק מובילים\" / \"בתי עסק מובילים בחודש שעבר\"",
  "• \"קטגוריות מובילות\"",
].join("\n");

export async function runAssistantCommand(query: string, ctx: Ctx, locale: "he" | "en"): Promise<AssistantResult> {
  const q = query.trim();
  const lower = q.toLowerCase();
  const lastMonth = /last month|חודש שעבר/i.test(q) ? 1 : 0;

  // categorize <merchant> as <category>
  const catMatch = lower.match(/^(?:categorize|set|make)\s+(.+?)\s+(?:as|to)\s+(.+)$/i);
  if (catMatch) {
    const [, merchant, category] = catMatch;
    const result = await learnAndApplyRule({
      merchantPattern: merchant.trim(),
      category: category.trim(),
      entityId: null,
    });
    return {
      reply:
        locale === "he"
          ? `נוצר כלל: "${merchant.trim()}" → ${category.trim()}. עודכנו ${result.updatedCount} תנועות.`
          : `Rule created: "${merchant.trim()}" → ${category.trim()}. Updated ${result.updatedCount} transactions.`,
    };
  }

  // Hebrew: קטלג את X כY / קטלג X בתור Y
  const catMatchHe = q.match(/קטלג\s+(?:את\s+)?(.+?)\s+(?:כ|בתור)\s*(.+)/);
  if (catMatchHe) {
    const [, merchant, category] = catMatchHe;
    const result = await learnAndApplyRule({
      merchantPattern: merchant.trim(),
      category: category.trim(),
      entityId: null,
    });
    return {
      reply: `נוצר כלל: "${merchant.trim()}" → ${category.trim()}. עודכנו ${result.updatedCount} תנועות.`,
    };
  }

  // how much did I spend on <category>
  const spendMatch = lower.match(/how much.*(?:spen[dt]).*on\s+([a-z0-9 ]+?)(?:\s+last month| this month)?\??$/i);
  const spendMatchHe = q.match(/כמה הוצאתי על\s+(.+?)(?:\s+בחודש שעבר)?\??$/);
  if (spendMatch || spendMatchHe) {
    const category = (spendMatch?.[1] ?? spendMatchHe?.[1] ?? "").trim();
    const { total, count } = await spendOnCategory(category, ctx, lastMonth);
    return {
      reply:
        locale === "he"
          ? `הוצאת ${total.toLocaleString()} על ${category} (${count} תנועות).`
          : `You spent ${total.toLocaleString()} on ${category} (${count} transactions).`,
      data: { total, count },
    };
  }

  // top merchants
  if (/top merchants?/i.test(lower) || /בתי עסק מובילים/.test(q)) {
    const merchants = await topMerchants(ctx, lastMonth);
    const lines = merchants.map(([m, amt], i) => `${i + 1}. ${m} — ${amt.toLocaleString()}`);
    return {
      reply: lines.length ? lines.join("\n") : locale === "he" ? "אין נתונים." : "No data.",
      data: merchants,
    };
  }

  // top categories
  if (/top categories/i.test(lower) || /קטגוריות מובילות/.test(q)) {
    const { start, end } = monthRange(lastMonth);
    const rows = await prisma.transaction.findMany({
      where: {
        amount: { lt: 0 },
        date: { gte: start, lt: end },
        accountMapping: ctx.entityId ? { entityId: ctx.entityId } : undefined,
      },
    });
    const totals = new Map<string, number>();
    for (const r of rows) {
      const key = r.category ?? "Uncategorized";
      totals.set(key, (totals.get(key) ?? 0) + Math.abs(r.amount));
    }
    const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const lines = sorted.map(([c, amt], i) => `${i + 1}. ${c} — ${amt.toLocaleString()}`);
    return {
      reply: lines.length ? lines.join("\n") : locale === "he" ? "אין נתונים." : "No data.",
      data: sorted,
    };
  }

  return { reply: locale === "he" ? HELP_HE : HELP_EN };
}
