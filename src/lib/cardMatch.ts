// Shared heuristic for tying a bank-account debit line (e.g. "לאומי
// מאסטרקארד") to the specific credit card it's actually charging — used by
// the forecast's billing-day detection and by the Transactions screen to
// label a bank charge with the card it belongs to, so amounts across the two
// screens are traceable back to the same card instead of showing up as
// identically-named, seemingly-unexplained duplicates.

export interface CardForMatching {
  id: string;
  name: string;
  accountNumber: string | null;
  displayName: string;
}

export function matchCardForDescription(
  description: string | null,
  cards: CardForMatching[]
): CardForMatching | null {
  const desc = description ?? "";
  for (const card of cards) {
    const last4 = card.accountNumber?.replace(/[^0-9]/g, "").slice(-4);
    const nameNeedle = card.displayName?.trim();
    const matchesDigits = last4 && desc.includes(last4);
    const matchesName = nameNeedle && nameNeedle.length > 3 && desc.includes(nameNeedle);
    if (matchesDigits || matchesName) return card;
  }
  return null;
}

export interface CardCycleForMatching {
  id: string;
  name: string;
  entityId: string | null;
  isImmediateDebit: boolean;
  dayOfMonth: number | null;
  chargeAmount: number;
  previousAmount: number | null;
}

// Israeli bank exports commonly describe a card's monthly charge with a
// generic issuer name only (e.g. "לאומי מאסטרקארד"), with no card-specific
// digits or label — so when several cards share an issuer, text matching
// (matchCardForDescription) can't tell them apart. This falls back to
// matching by amount: a bank debit dated on (or within a day of, for
// Shabbat/holiday postponement) a card's billing day, whose amount is close
// to that card's charge for the cycle closing on that date, is presumably
// that card's charge.
export function matchCardForAmount(
  tx: { entityId: string | null; date: Date; amount: number },
  cards: CardCycleForMatching[]
): CardCycleForMatching | null {
  const day = tx.date.getDate();
  const absAmount = Math.abs(tx.amount);
  let best: { card: CardCycleForMatching; diff: number } | null = null;
  for (const card of cards) {
    if (card.isImmediateDebit || card.dayOfMonth == null) continue;
    if (card.entityId !== tx.entityId) continue;
    if (Math.abs(day - card.dayOfMonth) > 1) continue;
    for (const candidateAmount of [card.chargeAmount, card.previousAmount]) {
      if (candidateAmount == null || candidateAmount <= 0) continue;
      const diff = Math.abs(candidateAmount - absAmount);
      const tolerance = Math.max(1, candidateAmount * 0.01);
      if (diff > tolerance) continue;
      if (!best || diff < best.diff) best = { card, diff };
    }
  }
  return best?.card ?? null;
}
