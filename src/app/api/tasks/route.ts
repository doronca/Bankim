import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/tasks?entity=<id>&status=open — tasks for the dashboard list.
// "open" excludes done tasks and anything currently snoozed; pass status=all
// to get everything (used by the transaction row itself).
export async function GET(req: NextRequest) {
  const entityId = req.nextUrl.searchParams.get("entity");
  const status = req.nextUrl.searchParams.get("status") ?? "open";
  const transactionId = req.nextUrl.searchParams.get("transactionId");

  const now = new Date();
  const tasks = await prisma.task.findMany({
    where: {
      transactionId: transactionId ?? undefined,
      transaction: entityId ? { accountMapping: { entityId } } : undefined,
      ...(status === "open" ? { status: "open", OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }] } : {}),
    },
    include: {
      notes: { orderBy: { createdAt: "asc" } },
      transaction: { select: { id: true, description: true, date: true, amount: true, currency: true } },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(tasks);
}

// POST /api/tasks — create a task on a transaction. Body: { transactionId, title, dueDate? }
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { transactionId: string; title: string; dueDate?: string | null };
  if (!body.transactionId || !body.title?.trim()) {
    return NextResponse.json({ error: "transactionId and title are required" }, { status: 400 });
  }
  const task = await prisma.task.create({
    data: {
      transactionId: body.transactionId,
      title: body.title.trim(),
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
    },
    include: { notes: true },
  });
  return NextResponse.json(task);
}
