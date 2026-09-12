import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/insights/[id] { dismissed: boolean }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { dismissed: boolean };
  const insight = await prisma.insight.update({
    where: { id },
    data: { dismissed: body.dismissed },
  });
  return NextResponse.json(insight);
}
