import { prisma } from "@/lib/prisma";
import { categorizeTransaction } from "@/lib/categorize/engine";
import { NEAR_DUPLICATE_WINDOW_DAYS } from "@/lib/nearDuplicates";

const DUPLICATE_MATCH_WINDOW_MS = NEAR_DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

// OpenFinance (Financy) Open Banking API client — read-only.
// Confirmed against https://docs.open-finance.ai (Aug 2026).
//
// This is a PSD2-style consent flow, not a plain data pull:
//   1. listProviders()            — pick a bank
//   2. initConnection(providerId, psuId) — returns a scaOAuth link
//   3. the user opens that link and authenticates with their bank
//   4. finalizeConnection(connectionId)  — completes the link
//   5. only then do syncAccountMappings()/syncTransactions() return data
//
// Steps 1-4 happen once per bank account and are driven from the
// onboarding UI; syncAccountMappings/syncTransactions are safe to re-run
// on a schedule once a connection is CONNECTED.

const BASE_URL = process.env.OPENFINANCE_BASE_URL ?? "https://api.open-finance.ai";
const DATA_URL = `${BASE_URL}/v2`;

interface TokenCache {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let tokenCache: TokenCache | null = null;

function requireCreds() {
  const userId = process.env.OPENFINANCE_USER_ID;
  const clientId = process.env.OPENFINANCE_CLIENT_ID;
  const clientSecret = process.env.OPENFINANCE_CLIENT_SECRET;
  if (!userId || !clientId || !clientSecret) {
    throw new Error(
      "OpenFinance credentials missing. Set OPENFINANCE_USER_ID, OPENFINANCE_CLIENT_ID, OPENFINANCE_CLIENT_SECRET in .env"
    );
  }
  return { userId, clientId, clientSecret };
}

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) {
    return tokenCache.accessToken;
  }
  const { userId, clientId, clientSecret } = requireCreds();

  const res = await fetch(`${BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, clientId, clientSecret }),
  });

  if (!res.ok) {
    throw new Error(`OpenFinance token request failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { accessToken: string; expiresIn: number; tokenType: string };
  tokenCache = {
    accessToken: data.accessToken,
    // expiresIn is documented in ms
    expiresAt: Date.now() + data.expiresIn,
  };
  return tokenCache.accessToken;
}

async function authedFetch(path: string, init?: RequestInit) {
  const token = await getAccessToken();
  const res = await fetch(`${DATA_URL}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`OpenFinance request failed (${path}): ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// --- Consent / connection flow -------------------------------------------

export interface Provider {
  id: string; // = providerFriendlyId, the value every other endpoint calls providerId
  name: string;
  nameNativeLanguage?: string;
}

interface RawProvider {
  providerFriendlyId: string;
  name: string;
  nameNativeLanguage?: string;
}

export async function listProviders(): Promise<Provider[]> {
  const data = (await authedFetch("/providers")) as { items?: RawProvider[] } | RawProvider[];
  const items = Array.isArray(data) ? data : data.items ?? [];
  return items.map((p) => ({ id: p.providerFriendlyId, name: p.name, nameNativeLanguage: p.nameNativeLanguage }));
}

export interface InitConnectionResult {
  connection: { id: string; status: string };
  scaOAuth: string; // link for the user to authenticate with their bank
}

// Starts linking one bank account: creates a connection record and returns
// the bank's own OAuth link. The user must open scaOAuth in a browser and
// complete login/consent at their bank before finalizeConnection will work.
export async function initConnection(providerId: string, psuId: string): Promise<InitConnectionResult> {
  const { userId } = requireCreds();
  const connectionId = `${userId}-${providerId}-${Date.now()}`;
  return authedFetch("/connect/open-banking-init", {
    method: "POST",
    body: JSON.stringify({ providerId, connectionId, psuId }),
  }) as Promise<InitConnectionResult>;
}

export async function finalizeConnection(connectionId: string) {
  return authedFetch(`/connect/open-banking-finalize?connectionId=${encodeURIComponent(connectionId)}`);
}

export interface Connection {
  id: string;
  providerId: string;
  status: string;
  accounts?: number;
}

export async function listConnections(): Promise<Connection[]> {
  const { userId } = requireCreds();
  const data = (await authedFetch(`/connections?userId=${encodeURIComponent(userId)}`)) as
    | { items?: Connection[] }
    | Connection[];
  return Array.isArray(data) ? data : data.items ?? [];
}

// --- Data sync (only returns rows for CONNECTED connections) -------------

interface OFAccount {
  id: string;
  accountName?: string;
  accountNumber?: string;
  accountType: "CHECKING" | "CARD" | "LOAN" | "SAVINGS" | "SECURITIES";
  currency: string;
  providerId?: string;
}

interface OFTransactionAmount {
  chargedAmount?: { amount: number | string | null; currency: string };
  originalAmount?: { amount: number | string | null; currency: string };
}

interface OFTransaction {
  id: string;
  SK?: string;
  accountId?: string;
  date: { transactionDate?: string; bookingDate?: string; valueDate?: string };
  amount: OFTransactionAmount;
  description?: { description?: string; additionalInfo?: string };
  merchantName?: string;
  isInvoiced?: boolean; // card transactions: whether this charge has already been billed
}

function accountTypeToMappingType(t: OFAccount["accountType"]) {
  if (t === "CARD") return "credit_card" as const;
  if (t === "SECURITIES") return "investment_portfolio" as const;
  return "bank_account" as const;
}

// Ensures every discovered account (across all CONNECTED connections) has an
// AccountMapping row (entity left null until the user maps it in onboarding).
export async function syncAccountMappings() {
  const { userId } = requireCreds();
  const [data, providers] = await Promise.all([
    authedFetch(`/data/accounts?userId=${encodeURIComponent(userId)}&limit=200`) as Promise<{
      items: OFAccount[];
    }>,
    listProviders().catch(() => [] as Provider[]),
  ]);
  const providerNames = new Map(providers.map((p) => [p.id, p.name]));

  for (const acc of data.items) {
    const providerName = acc.providerId ? providerNames.get(acc.providerId) ?? acc.providerId : null;
    // "XXX" is the ISO-4217 code for "no currency" — the OpenFinance
    // sandbox returns it for some accounts instead of the real currency.
    // Falling back to ILS keeps amounts/labels sane rather than showing the
    // placeholder code to the user.
    const currency = acc.currency && acc.currency !== "XXX" ? acc.currency : "ILS";
    await prisma.accountMapping.upsert({
      where: { source_externalId: { source: "openfinance", externalId: acc.id } },
      update: {
        displayName: acc.accountName ?? acc.accountNumber ?? acc.id,
        currency,
        accountNumber: acc.accountNumber ?? null,
        providerId: acc.providerId ?? null,
        providerName,
      },
      create: {
        source: "openfinance",
        externalId: acc.id,
        displayName: acc.accountName ?? acc.accountNumber ?? acc.id,
        accountType: accountTypeToMappingType(acc.accountType),
        currency,
        accountNumber: acc.accountNumber ?? null,
        providerId: acc.providerId ?? null,
        providerName,
      },
    });
  }
  return data.items.length;
}

// Pulls transactions for every mapped OpenFinance account (one call per
// account, filtered by accountId — the API rejects a bare userId filter on
// this endpoint), upserting by (accountMappingId, sourceRef) so re-runs are
// idempotent.
export async function syncTransactions() {
  const mappings = await prisma.accountMapping.findMany({ where: { source: "openfinance" } });
  let imported = 0;

  for (const mapping of mappings) {
    let nextPage: string | undefined;
    do {
      const qs = new URLSearchParams({ accountId: mapping.externalId, limit: "200" });
      if (nextPage) qs.set("nextPage", nextPage);

      const data = (await authedFetch(`/data/transactions?${qs.toString()}`)) as {
        items: OFTransaction[];
        nextPage?: string | null;
      };

      for (const tx of data.items) {
        const amountInfo = tx.amount.chargedAmount ?? tx.amount.originalAmount;
        const amountValue = amountInfo ? Number(amountInfo.amount) : NaN;
        if (!amountInfo || Number.isNaN(amountValue)) continue; // malformed row (seen on some foreign-currency card txns)

        const sourceRef = tx.SK ?? tx.id;
        const date = tx.date.bookingDate ?? tx.date.transactionDate ?? tx.date.valueDate;
        const description = tx.description?.description ?? tx.merchantName ?? "";
        const additionalInfo = tx.description?.additionalInfo?.trim() || null;

        // Only newly-created rows get auto-categorized — never overwrite a
        // category the user (or a prior sync) already set on an existing row.
        const existing = await prisma.transaction.findUnique({
          where: { accountMappingId_sourceRef: { accountMappingId: mapping.id, sourceRef } },
          select: { id: true },
        });

        // OpenFinance has been observed reporting a card charge twice: once
        // as a pending authorization (isInvoiced: false, dated the actual
        // purchase date) and again a few days later once it settles, under
        // a brand-new sourceRef and a slightly later date — which defeats
        // the (accountMappingId, sourceRef) idempotency key above and would
        // otherwise import a second, duplicate row (this was confirmed to
        // be inflating the Forecast screen's pending-charge totals). Match
        // loosely by date proximity — not an exact date, since the settled
        // date differs from the authorization date — and only against a
        // still-pending row, so two genuinely separate same-amount charges
        // at the same merchant (e.g. a recurring subscription) aren't
        // wrongly merged into one.
        if (!existing) {
          const txDate = date ? new Date(date) : new Date();
          const possibleDuplicate = await prisma.transaction.findFirst({
            where: {
              accountMappingId: mapping.id,
              amount: amountValue,
              description,
              isInvoiced: false,
              date: {
                gte: new Date(txDate.getTime() - DUPLICATE_MATCH_WINDOW_MS),
                lte: new Date(txDate.getTime() + DUPLICATE_MATCH_WINDOW_MS),
              },
            },
            select: { id: true },
          });
          if (possibleDuplicate) {
            // Update the pending row in place (new sourceRef, settled date
            // and isInvoiced) rather than leaving it stuck pending forever
            // while a duplicate settled row gets imported alongside it.
            await prisma.transaction.update({
              where: { id: possibleDuplicate.id },
              data: {
                sourceRef,
                amount: amountValue,
                currency: amountInfo.currency,
                description,
                additionalInfo,
                date: txDate,
                isInvoiced: tx.isInvoiced ?? null,
              },
            });
            imported++;
            continue;
          }
        }

        const match = existing
          ? null
          : await categorizeTransaction({ description, entityId: mapping.entityId });

        await prisma.transaction.upsert({
          where: { accountMappingId_sourceRef: { accountMappingId: mapping.id, sourceRef } },
          update: {
            amount: amountValue,
            currency: amountInfo.currency,
            description,
            additionalInfo,
            date: date ? new Date(date) : new Date(),
            isInvoiced: tx.isInvoiced ?? null,
          },
          create: {
            accountMappingId: mapping.id,
            sourceRef,
            amount: amountValue,
            currency: amountInfo.currency,
            description,
            additionalInfo,
            merchantNormalized: tx.merchantName ?? null,
            date: date ? new Date(date) : new Date(),
            category: match?.category ?? null,
            autoRuleId: match?.ruleId ?? null,
            isInvoiced: tx.isInvoiced ?? null,
          },
        });
        imported++;
      }

      nextPage = data.nextPage ?? undefined;
    } while (nextPage);
  }

  await prisma.syncState.upsert({
    where: { source: "openfinance" },
    update: { lastSyncedAt: new Date() },
    create: { source: "openfinance", lastSyncedAt: new Date() },
  });

  return imported;
}
