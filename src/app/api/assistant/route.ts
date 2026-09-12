import { NextRequest, NextResponse } from "next/server";
import { runAssistantCommand } from "@/lib/assistant";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { query: string; entityId?: string | null; locale?: "he" | "en" };
  if (!body.query?.trim()) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }
  const result = await runAssistantCommand(
    body.query,
    { entityId: body.entityId ?? null },
    body.locale ?? "en"
  );
  return NextResponse.json(result);
}
