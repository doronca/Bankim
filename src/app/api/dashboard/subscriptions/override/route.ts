import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST { merchant, isSubscription: true | false | null }
// null clears the override, reverting to the automatic cadence detection.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { merchant: string; isSubscription: boolean | null };
  const merchant = body.merchant.trim().toLowerCase();

  if (body.isSubscription === null) {
    await prisma.subscriptionOverride.deleteMany({ where: { merchant } });
    return NextResponse.json({ cleared: true });
  }

  const row = await prisma.subscriptionOverride.upsert({
    where: { merchant },
    update: { isSubscription: body.isSubscription },
    create: { merchant, isSubscription: body.isSubscription },
  });
  return NextResponse.json(row);
}
