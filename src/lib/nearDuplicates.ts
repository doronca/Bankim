// Card transactions from OpenFinance sometimes arrive twice for the same
// real-world purchase: once as a pending authorization (isInvoiced: false,
// dated on the actual purchase date) and again a couple of days later once
// it settles (isInvoiced: true, under a brand-new sourceRef, dated a few
// days after the original). Because the sourceRef differs, the exact-match
// dedupe (same account+date+amount+description) never catches this pair, so
// both rows persist and get double-counted anywhere transactions are summed
// (most visibly, the Forecast screen's pending-charge total came out well
// above what the card issuer's own statement shows).
//
// This finds those pairs — same account, description, and amount, dated
// within a few days of each other — and returns the id of the later,
// redundant row in each pair. The earlier-dated row is kept because it
// matches the real purchase date on the issuer's statement.
export const NEAR_DUPLICATE_WINDOW_DAYS = 5;
const WINDOW_MS = NEAR_DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export interface TxForDedup {
  id: string;
  accountMappingId: string;
  date: Date;
  amount: number;
  description: string;
}

export function findNearDuplicateIds(transactions: TxForDedup[]): Set<string> {
  const groups = new Map<string, TxForDedup[]>();
  for (const tx of transactions) {
    // Round to cents to avoid float-equality misses.
    const key = `${tx.accountMappingId}|${tx.description}|${Math.round(tx.amount * 100)}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(tx);
  }

  const redundant = new Set<string>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.date.getTime() - b.date.getTime());
    let lastKept = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      const tx = sorted[i];
      if (tx.date.getTime() - lastKept.date.getTime() <= WINDOW_MS) {
        redundant.add(tx.id);
      } else {
        lastKept = tx;
      }
    }
  }
  return redundant;
}
