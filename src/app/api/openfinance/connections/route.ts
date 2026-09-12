import { NextResponse } from "next/server";
import { listConnections } from "@/lib/ingest/openfinance";

export async function GET() {
  try {
    const connections = await listConnections();
    return NextResponse.json(connections);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
