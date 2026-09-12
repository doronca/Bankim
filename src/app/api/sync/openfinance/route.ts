import { NextResponse } from "next/server";
import { syncAccountMappings, syncTransactions } from "@/lib/ingest/openfinance";
import { runInsightsEngine } from "@/lib/insights/engine";

export async function POST() {
  try {
    const accountCount = await syncAccountMappings();
    const txCount = await syncTransactions();
    // Best-effort: a failure recomputing insights shouldn't fail the sync
    // itself, since the transactions are already safely persisted.
    const insights = await runInsightsEngine().catch(() => null);
    return NextResponse.json({ accountCount, txCount, insights });
  } catch (err) {
    const cause = (err as { cause?: unknown }).cause;
    return NextResponse.json(
      { error: (err as Error).message, cause: cause instanceof Error ? cause.message : cause },
      { status: 500 }
    );
  }
}
