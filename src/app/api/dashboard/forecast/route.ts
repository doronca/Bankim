import { NextRequest, NextResponse } from "next/server";
import { computeCardForecasts } from "@/lib/cardForecast";

// GET /api/dashboard/forecast?entity=<entityId>
export async function GET(req: NextRequest) {
  const entityId = req.nextUrl.searchParams.get("entity");
  const result = await computeCardForecasts(entityId);

  const totals = {
    pendingAmount: result.reduce((sum, c) => sum + c.pendingAmount, 0),
    futureTransactionsCount: result.reduce((sum, c) => sum + c.futureTransactionsCount, 0),
  };

  return NextResponse.json({ cards: result, totals });
}
