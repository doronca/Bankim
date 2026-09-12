import { NextResponse } from "next/server";
import { categorizeUncategorized, seedDefaultRules } from "@/lib/categorize/engine";
import { SEED_RULES } from "@/lib/categorize/seed-rules";

// POST: idempotently loads the built-in Israeli merchant category rules,
// then applies all rules (built-in + user-created) to any transaction that
// doesn't have a category yet.
export async function POST() {
  await seedDefaultRules(SEED_RULES);
  const updated = await categorizeUncategorized();
  return NextResponse.json({ seeded: SEED_RULES.length, categorized: updated });
}
