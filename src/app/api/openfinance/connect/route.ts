import { NextRequest, NextResponse } from "next/server";
import { initConnection } from "@/lib/ingest/openfinance";

// POST { providerId, psuId } -> { connection, scaOAuth }
// scaOAuth is the bank's own login link; the user must open it and
// authenticate there before finalize can succeed.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { providerId: string; psuId: string };
  try {
    const result = await initConnection(body.providerId, body.psuId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
