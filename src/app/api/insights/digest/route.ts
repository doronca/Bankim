import { NextRequest, NextResponse } from "next/server";
import { buildWeeklyDigest, formatWeeklyDigestText } from "@/lib/insights/engine";
import type { Locale } from "@/lib/i18n";

// GET /api/insights/digest?entity=<entityId>&locale=<he|en>
// Plain-text weekly executive digest for one entity (built for the parents'
// / brother's entities, but works for any entity id).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const entityId = searchParams.get("entity");
  if (!entityId) {
    return NextResponse.json({ error: "entity is required" }, { status: 400 });
  }
  const locale: Locale = searchParams.get("locale") === "en" ? "en" : "he";
  const data = await buildWeeklyDigest(entityId, new Date(), locale);
  const text = formatWeeklyDigestText(data, new Date(), locale);
  return NextResponse.json({ text });
}
