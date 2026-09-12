import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/tasks/:id — update title/dueDate/status, snooze, or un-snooze.
// Body: { title?, dueDate?: string|null, status?: "open"|"done", snoozedUntil?: string|null }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as {
    title?: string;
    dueDate?: string | null;
    status?: "open" | "done";
    snoozedUntil?: string | null;
  };

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...(body.title !== undefined ? { title: body.title.trim() } : {}),
      ...(body.dueDate !== undefined ? { dueDate: body.dueDate ? new Date(body.dueDate) : null } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.snoozedUntil !== undefined ? { snoozedUntil: body.snoozedUntil ? new Date(body.snoozedUntil) : null } : {}),
    },
    include: { notes: { orderBy: { createdAt: "asc" } } },
  });
  return NextResponse.json(task);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
