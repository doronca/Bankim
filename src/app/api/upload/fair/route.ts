import { NextRequest, NextResponse } from "next/server";
import { importFairFile } from "@/lib/ingest/fair";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await importFairFile(buffer, file.name);
    return NextResponse.json(result);
  } catch (err) {
    await prisma.fileUpload.create({
      data: {
        filename: file.name,
        source: "fair",
        status: "failed",
        errorMsg: (err as Error).message,
      },
    });
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
