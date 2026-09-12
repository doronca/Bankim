import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/tasks/:id/notes — append a note to a task. Body: { text }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { text: string };
  if (!body.text?.trim()) return NextResponse.json({ error: "text is required" }, { status: 400 });

  const note = await prisma.taskNote.create({ data: { taskId: id, text: body.text.trim() } });
  return NextResponse.json(note);
}
