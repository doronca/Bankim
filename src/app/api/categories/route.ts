import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const categories = await prisma.category.findMany({
    include: { group: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(categories);
}

// POST { name, groupId? }: adds a category to the catalog (used both by the
// presets and by the recategorize UI's "new category" autocomplete).
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { name: string; groupId?: string | null };
  if (!body.name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
  const category = await prisma.category.upsert({
    where: { name: body.name.trim() },
    update: { groupId: body.groupId ?? undefined },
    create: { name: body.name.trim(), groupId: body.groupId ?? null },
  });
  return NextResponse.json(category);
}
