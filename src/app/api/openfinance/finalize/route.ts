import { NextRequest, NextResponse } from "next/server";
import { finalizeConnection } from "@/lib/ingest/openfinance";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { connectionId: string };
  try {
    const result = await finalizeConnection(body.connectionId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
