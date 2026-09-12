import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BUSINESS_PRESET, HOUSEHOLD_PRESET } from "@/lib/categoryPresets";

// POST { pack: "household" | "business" }
// Creates the preset's CategoryGroups and Categories. Existing categories are
// reassigned to the preset's group (not duplicated); existing groups with the
// same name are reused rather than recreated.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { pack: "household" | "business" };
  const preset = body.pack === "business" ? BUSINESS_PRESET : HOUSEHOLD_PRESET;

  let groupsCreated = 0;
  let categoriesCreated = 0;

  const maxOrder = await prisma.categoryGroup.aggregate({ _max: { order: true } });
  let nextOrder = (maxOrder._max.order ?? -1) + 1;

  for (const [groupName, categories] of Object.entries(preset)) {
    let group = await prisma.categoryGroup.findFirst({ where: { name: groupName } });
    if (!group) {
      group = await prisma.categoryGroup.create({ data: { name: groupName, order: nextOrder++ } });
      groupsCreated++;
    }
    for (const categoryName of categories) {
      const existing = await prisma.category.findUnique({ where: { name: categoryName } });
      if (!existing) {
        await prisma.category.create({ data: { name: categoryName, groupId: group.id } });
        categoriesCreated++;
      }
    }
  }

  return NextResponse.json({ groupsCreated, categoriesCreated });
}
