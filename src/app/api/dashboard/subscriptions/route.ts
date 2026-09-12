import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PRICE_INCREASE_THRESHOLD = 0.10; // 10%

// Known billing cadences, as [minDays, maxDays] the *median* gap between
// charges must fall into for a merchant to be treated as recurring.
const CADENCE_BANDS: { name: string; min: number; max: number }[] = [
  { name: "weekly", min: 5, max: 9 },
  { name: "biweekly", min: 12, max: 16 },
  { name: "monthly", min: 25, max: 35 },
  { name: "bimonthly", min: 55, max: 65 },
  { name: "quarterly", min: 85, max: 97 },
  { name: "yearly", min: 350, max: 380 },
];

interface SubscriptionGroup {
  merchant: string;
  category: string | null;
  occurrences: { date: string; amount: number }[];
  lastAmount: number;
  previousAmount: number;
  percentIncrease: number | null;
  alert: boolean;
  isRecurring: boolean;
  cadence: string | null;
  isOverridden: boolean;
}

function median(nums: number[]) {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Classifies a merchant's charge history as recurring or one-off/occasional
// by looking at the *regularity* of the gaps between charges, not just how
// many there were — a supermarket visited 5 times in irregular bursts is not
// a subscription; a gym charged every ~30 days is.
function detectCadence(dates: Date[]): { isRecurring: boolean; cadence: string | null } {
  if (dates.length < 3) return { isRecurring: false, cadence: null };

  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const intervalsDays: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    intervalsDays.push((sorted[i].getTime() - sorted[i - 1].getTime()) / 86_400_000);
  }

  const med = median(intervalsDays);
  const band = CADENCE_BANDS.find((b) => med >= b.min && med <= b.max);
  if (!band) return { isRecurring: false, cadence: null };

  // Require the gaps to actually cluster around that cadence (regular
  // billing), not just have a median that happens to land in range.
  const mean = intervalsDays.reduce((s, n) => s + n, 0) / intervalsDays.length;
  const variance = intervalsDays.reduce((s, n) => s + (n - mean) ** 2, 0) / intervalsDays.length;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : Infinity;

  return { isRecurring: cv < 0.4, cadence: band.name };
}

// GET /api/dashboard/subscriptions?entity=personal
// Groups expense transactions by merchant, classifies each as a recurring
// subscription (regular billing cadence) vs. an occasional/one-off expense,
// flags recurring merchants whose latest charge is >10% above the previous
// one, and applies any manual SubscriptionOverride on top of the heuristic.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const entityId = searchParams.get("entity");

  const [transactions, overrides] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        amount: { lt: 0 },
        accountMapping: entityId ? { entityId } : undefined,
      },
      include: { accountMapping: true },
      orderBy: { date: "asc" },
    }),
    prisma.subscriptionOverride.findMany(),
  ]);
  const overrideMap = new Map(overrides.map((o) => [o.merchant, o.isSubscription]));

  const groups = new Map<string, { date: Date; amount: number; category: string | null }[]>();
  for (const tx of transactions) {
    const key = (tx.merchantNormalized ?? tx.description).trim().toLowerCase();
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ date: tx.date, amount: Math.abs(tx.amount), category: tx.category });
  }

  const results: SubscriptionGroup[] = [];
  for (const [merchant, occ] of groups.entries()) {
    const override = overrideMap.get(merchant);
    if (occ.length < 2 && override === undefined) continue;

    const sorted = [...occ].sort((a, b) => a.date.getTime() - b.date.getTime());
    const last = sorted[sorted.length - 1];
    const prev = sorted.length > 1 ? sorted[sorted.length - 2] : last;
    const percentIncrease = sorted.length > 1 && prev.amount > 0 ? (last.amount - prev.amount) / prev.amount : null;
    const detected = detectCadence(sorted.map((o) => o.date));
    const isRecurring = override ?? detected.isRecurring;

    results.push({
      merchant,
      category: last.category,
      occurrences: sorted.map((o) => ({ date: o.date.toISOString(), amount: o.amount })),
      lastAmount: last.amount,
      previousAmount: prev.amount,
      percentIncrease,
      alert: isRecurring && percentIncrease !== null && percentIncrease > PRICE_INCREASE_THRESHOLD,
      isRecurring,
      cadence: detected.cadence,
      isOverridden: override !== undefined,
    });
  }

  results.sort((a, b) => Number(b.alert) - Number(a.alert) || Number(b.isRecurring) - Number(a.isRecurring));
  return NextResponse.json(results);
}
