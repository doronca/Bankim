import { XMLParser } from "fast-xml-parser";
import { prisma } from "@/lib/prisma";

// Interactive Brokers Flex Web Service client (read-only).
// Two-step flow: SendRequest (returns a ReferenceCode) then GetStatement
// (polled until the report is ready), per IBKR's Flex Web Service spec.
// https://www.interactivebrokers.com/campus/ibkr-api-page/flex-web-service/

const BASE_URL = process.env.IBKR_FLEX_BASE_URL ?? "https://gdcdyn.interactivebrokers.com/Universal/servlet";
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 10;

function requireCreds() {
  const token = process.env.IBKR_FLEX_TOKEN;
  const queryId = process.env.IBKR_FLEX_QUERY_ID;
  if (!token || !queryId) {
    throw new Error("IBKR credentials missing. Set IBKR_FLEX_TOKEN, IBKR_FLEX_QUERY_ID in .env");
  }
  return { token, queryId };
}

async function sendRequest(): Promise<string> {
  const { token, queryId } = requireCreds();
  const res = await fetch(
    `${BASE_URL}/FlexStatementService.SendRequest?t=${token}&q=${queryId}&v=3`
  );
  const xml = await res.text();
  const parsed = new XMLParser().parse(xml);
  const status = parsed?.FlexStatementResponse;
  if (!status || status.Status !== "Success") {
    throw new Error(`IBKR SendRequest failed: ${JSON.stringify(status)}`);
  }
  return status.ReferenceCode as string;
}

async function getStatement(referenceCode: string): Promise<string> {
  const { token } = requireCreds();
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const res = await fetch(
      `${BASE_URL}/FlexStatementService.GetStatement?t=${token}&q=${referenceCode}&v=3`
    );
    const xml = await res.text();
    if (xml.includes("<FlexQueryResponse")) return xml;
    if (xml.includes("<ErrorCode>1019</ErrorCode>")) {
      // Statement generation in progress; wait and retry.
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      continue;
    }
    throw new Error(`IBKR GetStatement error: ${xml}`);
  }
  throw new Error("IBKR GetStatement timed out waiting for report generation");
}

export async function fetchFlexStatement(): Promise<string> {
  const ref = await sendRequest();
  return getStatement(ref);
}

function toArray<T>(v: T | T[] | undefined): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

// Parses the Flex XML and upserts cash, positions, and trades against the
// AccountMapping registered for this IBKR account id, keyed off <accountId>.
export async function importFlexStatement(xml: string) {
  const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" }).parse(xml);
  const statements = toArray(parsed?.FlexQueryResponse?.FlexStatements?.FlexStatement);

  let positions = 0;
  let trades = 0;
  let cashLines = 0;

  for (const stmt of statements) {
    const accountId: string = stmt.accountId;
    const mapping = await prisma.accountMapping.upsert({
      where: { source_externalId: { source: "ibkr", externalId: accountId } },
      update: {},
      create: {
        source: "ibkr",
        externalId: accountId,
        displayName: `IBKR ${accountId}`,
        accountType: "investment_portfolio",
        currency: "USD",
      },
    });

    const asOf = stmt.whenGenerated ? new Date(stmt.whenGenerated) : new Date();

    for (const p of toArray(stmt.OpenPositions?.OpenPosition)) {
      await prisma.ibkrPosition.create({
        data: {
          accountMappingId: mapping.id,
          symbol: p.symbol,
          description: p.description ?? null,
          assetCategory: p.assetCategory ?? null,
          quantity: Number(p.position),
          markPrice: Number(p.markPrice),
          positionValue: Number(p.positionValue),
          currency: p.currency ?? "USD",
          asOfDate: asOf,
        },
      });
      positions++;
    }

    for (const t of toArray(stmt.Trades?.Trade)) {
      const tradeDate = t.tradeDate ? new Date(t.tradeDate) : asOf;
      await prisma.ibkrTrade.upsert({
        where: {
          accountMappingId_sourceTradeId: {
            accountMappingId: mapping.id,
            sourceTradeId: t.tradeID ?? `${t.symbol}-${t.tradeDate}-${t.quantity}`,
          },
        },
        update: {},
        create: {
          accountMappingId: mapping.id,
          symbol: t.symbol,
          tradeDate,
          quantity: Number(t.quantity),
          price: Number(t.tradePrice),
          proceeds: Number(t.proceeds),
          commission: Number(t.ibCommission ?? 0),
          currency: t.currency ?? "USD",
          buySell: t.buySell ?? "",
          sourceTradeId: t.tradeID ?? null,
        },
      });
      trades++;
    }

    for (const c of toArray(stmt.CashReport?.CashReportCurrency)) {
      if (c.currency === "BASE_SUMMARY") continue;
      await prisma.ibkrCashLine.create({
        data: {
          accountMappingId: mapping.id,
          currency: c.currency,
          endingCash: Number(c.endingCash),
          asOfDate: asOf,
        },
      });
      cashLines++;
    }
  }

  await prisma.syncState.upsert({
    where: { source: "ibkr" },
    update: { lastSyncedAt: new Date() },
    create: { source: "ibkr", lastSyncedAt: new Date() },
  });

  return { positions, trades, cashLines };
}

export async function syncIbkr() {
  const xml = await fetchFlexStatement();
  return importFlexStatement(xml);
}
