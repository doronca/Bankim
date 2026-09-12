import { NextRequest, NextResponse } from "next/server";
import { buildWeeklyDigest, formatWeeklyDigestText } from "@/lib/insights/engine";

// GET /api/insights/digest?entity=<entityId>
// Plain-text weekly executive digest for one entity (built for the parents'
// / brother's entities, but works for any entity id).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const entityId = searchParams.get("entity");
  if (!entityId) {
    return NextResponse.json({ error: "entity is required" }, { status: 400 });
  }
  const data = await buildWeeklyDigest(entityId);
  const text = formatWeeklyDigestText(data);
  return NextResponse.json({ text });
}
