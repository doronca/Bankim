import { NextResponse } from "next/server";
import { syncIbkr } from "@/lib/ingest/ibkr";
import { runInsightsEngine } from "@/lib/insights/engine";

export async function POST() {
  try {
    const result = await syncIbkr();
    const insights = await runInsightsEngine().catch(() => null);
    return NextResponse.json({ ...result, insights });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
