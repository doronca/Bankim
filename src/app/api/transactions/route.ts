import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma, AccountType } from "@/generated/prisma";

// GET /api/transactions?entity=<entityId>&category=Groceries&accountId=<id>
//   &accountType=credit_card&sign=expense&search=text&hideFuture=1&from=2026-01-01&to=2026-02-01
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const entityId = searchParams.get("entity");
  const category = searchParams.get("category");
  const accountId = searchParams.get("accountId");
  const accountType = searchParams.get("accountType");
  const sign = searchParams.get("sign"); // "income" | "expense"
  // "search" supersedes the older "merchant" param but both are honored.
  const search = searchParams.get("search") ?? searchParams.get("merchant");
  const hideFuture = searchParams.get("hideFuture") === "1";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const searchOr: Prisma.TransactionWhereInput[] | undefined = search
    ? [
        { description: { contains: search } },
        { note: { contains: search } },
        { category: { contains: search } },
        { additionalInfo: { contains: search } },
      ]
    : undefined;

  const transactions = await prisma.transaction.findMany({
    where: {
      accountMappingId: accountId ?? undefined,
      accountMapping: {
        entityId: entityId ?? undefined,
        accountType: accountType ? (accountType as AccountType) : undefined,
      },
      category: category ?? undefined,
      amount: sign === "income" ? { gt: 0 } : sign === "expense" ? { lt: 0 } : undefined,
      OR: searchOr,
      date: {
        gte: from ? new Date(from) : undefined,
        lte: hideFuture
          ? new Date()
          : to
          ? new Date(`${to}T23:59:59.999`)
          : undefined,
      },
    },
    include: { accountMapping: { include: { entity: true, mergedInto: true } } },
    orderBy: { date: "desc" },
    take: 2000,
  });

  return NextResponse.json(transactions);
}
