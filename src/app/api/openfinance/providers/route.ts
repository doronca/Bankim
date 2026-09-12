import { NextResponse } from "next/server";
import { listProviders } from "@/lib/ingest/openfinance";

export async function GET() {
  try {
    const providers = await listProviders();
    // The catalog occasionally repeats the same id (seen with sandbox entries);
    // de-dupe so <option key> stays unique.
    const seen = new Set<string>();
    const deduped = providers.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
    return NextResponse.json(deduped);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
