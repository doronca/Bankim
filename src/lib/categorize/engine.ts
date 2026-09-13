import { prisma } from "@/lib/prisma";

function normalizeMerchant(raw: string): string {
  return raw.trim().toLowerCase();
}

function matches(rule: { matchType: string; pattern: string }, text: string): boolean {
  const t = text.toLowerCase();
  if (rule.matchType === "regex") {
    try {
      return new RegExp(rule.pattern, "i").test(text);
    } catch {
      return false;
    }
  }
  if (rule.matchType === "exact") return t === rule.pattern.toLowerCase();
  return t.includes(rule.pattern.toLowerCase());
}

// Finds the best matching AutoRule for a transaction description, preferring
// entity-scoped rules over global ones, then higher priority, then most recent.
export async function categorizeTransaction(params: {
  description: string;
  entityId: string | null;
}): Promise<{ category: string; ruleId: string } | null> {
  const rules = await prisma.autoRule.findMany({
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
  });

  const text = normalizeMerchant(params.description);
  const candidates = rules.filter((r) => matches(r, text));
  if (candidates.length === 0) return null;

  const scoped = params.entityId
    ? candidates.find((r) => r.entityId === params.entityId)
    : undefined;
  const chosen = scoped ?? candidates.find((r) => r.entityId === null) ?? candidates[0];

  return { category: chosen.category, ruleId: chosen.id };
}

// Called when the user manually re-categorizes a transaction in the UI.
// Persists the rule, then reapplies it to all matching transactions (past + future).
export async function learnAndApplyRule(params: {
  merchantPattern: string;
  category: string;
  entityId?: string | null;
  matchType?: "contains" | "regex" | "exact";
}) {
  const rule = await prisma.autoRule.create({
    data: {
      pattern: params.merchantPattern,
      category: params.category,
      entityId: params.entityId ?? null,
      matchType: params.matchType ?? "contains",
    },
  });

  const candidates = await prisma.transaction.findMany({
    include: { accountMapping: true },
  });

  const toUpdate = candidates.filter((tx) => {
    if (params.entityId && tx.accountMapping.entityId !== params.entityId) return false;
    return matches(rule, tx.description) || (tx.merchantNormalized && matches(rule, tx.merchantNormalized));
  });

  if (toUpdate.length > 0) {
    await prisma.$transaction(
      toUpdate.map((tx) =>
        prisma.transaction.update({
          where: { id: tx.id },
          data: { category: params.category, autoRuleId: rule.id },
        })
      )
    );
  }

  return { rule, updatedCount: toUpdate.length };
}

// Updates just one transaction's category, with no AutoRule created — used
// when the user explicitly opts out of applying the change elsewhere.
export async function categorizeSingleTransaction(id: string, category: string) {
  return prisma.transaction.update({
    where: { id },
    data: { category, autoRuleId: null },
  });
}

// Applies every existing AutoRule to transactions that don't have a category
// yet — used after seeding the built-in rules, so they take effect on
// already-synced data instead of only future transactions.
export async function categorizeUncategorized() {
  const uncategorized = await prisma.transaction.findMany({
    where: { category: null },
    include: { accountMapping: true },
  });

  let updated = 0;
  for (const tx of uncategorized) {
    const match = await categorizeTransaction({
      description: tx.description,
      entityId: tx.accountMapping.entityId,
    });
    if (match) {
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { category: match.category, autoRuleId: match.ruleId },
      });
      updated++;
    }
  }
  return updated;
}

// Builds merchant -> most-common-category lookup from transactions the user
// has already categorized (manually or via a rule), for transactions that no
// AutoRule matches. Keyed by normalized merchantNormalized (falling back to
// description), so a transaction that shares a merchant with past ones gets
// a suggestion even without an explicit rule ever having been created for it.
export async function getCategorySuggestionMap(): Promise<Map<string, string>> {
  const categorized = await prisma.transaction.findMany({
    where: { category: { not: null } },
    select: { description: true, merchantNormalized: true, category: true },
  });

  const counts = new Map<string, Map<string, number>>();
  for (const tx of categorized) {
    const key = normalizeMerchant(tx.merchantNormalized ?? tx.description);
    if (!key || !tx.category) continue;
    const perCategory = counts.get(key) ?? new Map<string, number>();
    perCategory.set(tx.category, (perCategory.get(tx.category) ?? 0) + 1);
    counts.set(key, perCategory);
  }

  const suggestions = new Map<string, string>();
  for (const [key, perCategory] of counts) {
    let bestCategory: string | null = null;
    let bestCount = 0;
    for (const [category, count] of perCategory) {
      if (count > bestCount) {
        bestCategory = category;
        bestCount = count;
      }
    }
    if (bestCategory) suggestions.set(key, bestCategory);
  }
  return suggestions;
}

export function lookupCategorySuggestion(
  suggestions: Map<string, string>,
  tx: { description: string; merchantNormalized: string | null }
): string | null {
  const key = normalizeMerchant(tx.merchantNormalized ?? tx.description);
  return suggestions.get(key) ?? null;
}

export async function seedDefaultRules(seed: { pattern: string; category: string }[]) {
  for (const s of seed) {
    const exists = await prisma.autoRule.findFirst({
      where: { pattern: s.pattern, category: s.category, entityId: null },
    });
    if (!exists) {
      await prisma.autoRule.create({
        data: { pattern: s.pattern, category: s.category, matchType: "contains" },
      });
    }
  }
}
