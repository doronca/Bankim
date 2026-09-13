import type { Locale } from "@/lib/i18n";

// Renders an insight's title/message/actionText in the requested locale from
// its structured metadata, so the same generated insight can be displayed in
// Hebrew or English regardless of which locale it was originally computed
// in. `type`/`ruleKey` select the template; unknown shapes fall back to the
// stored (Hebrew) text produced by the insights engine.

export interface RenderableInsight {
  ruleKey?: string;
  type: string;
  title: string;
  message: string;
  actionText: string | null;
  metadata: Record<string, unknown> | null;
  entityName?: string | null;
}

export interface RenderedInsight {
  title: string;
  message: string;
  actionText: string | null;
}

function ilsHe(n: number) {
  return `${Math.round(n).toLocaleString()} ש"ח`;
}
function ilsEn(n: number) {
  return `₪${Math.round(n).toLocaleString()}`;
}

export function formatInsight(insight: RenderableInsight, locale: Locale): RenderedInsight {
  const m = insight.metadata ?? {};
  const fallback: RenderedInsight = { title: insight.title, message: insight.message, actionText: insight.actionText };
  if (locale === "he") return fallback;

  switch (insight.type) {
    case "price_creep": {
      const merchant = m.merchant as string | undefined;
      const lastAmount = m.lastAmount as number | undefined;
      const priorAvg = m.priorAvg as number | undefined;
      const deltaPct = m.deltaPct as number | undefined;
      if (merchant == null || lastAmount == null || priorAvg == null || deltaPct == null) return fallback;
      const deltaAbs = lastAmount - priorAvg;
      return {
        title: `Silent price increase: ${merchant}`,
        message: `The latest charge (${ilsEn(lastAmount)}) is ${(deltaPct * 100).toFixed(0)}% (${ilsEn(deltaAbs)}) higher than the average of the previous 3 charges (${ilsEn(priorAvg)}).`,
        actionText:
          `Hi, I noticed your latest charge for "${merchant}" was ${lastAmount.toFixed(2)} ILS, ` +
          `compared to an average of ${priorAvg.toFixed(2)} ILS in prior months — a ${(deltaPct * 100).toFixed(0)}% increase. ` +
          `I'd appreciate clarification on the reason for the increase, and whether it's possible to return to the previous price or cancel the subscription. Thank you.`,
      };
    }
    case "duplicate_subscriptions": {
      if (insight.ruleKey?.startsWith("duplicate_category:")) {
        const category = m.category as string | undefined;
        const merchants = m.merchants as string[] | undefined;
        const annualSavings = m.annualSavings as number | undefined;
        const cheapest = m.cheapestMerchant as string | undefined;
        const redundant = m.redundantMerchants as string[] | undefined;
        if (!category || !merchants || annualSavings == null || !cheapest || !redundant) return fallback;
        return {
          title: `Duplicate subscriptions in ${category}`,
          message: `Found ${merchants.length} active subscriptions in ${category}: ${merchants.join(", ")}. Consolidating and cancelling the duplicates could save about ${ilsEn(annualSavings)}/year.`,
          actionText: `Consider cancelling: ${redundant.join(", ")}, and keeping ${cheapest}.`,
        };
      }
      const merchant = m.merchant as string | undefined;
      const firstAmount = m.firstAmount as number | undefined;
      const lastAmount = m.lastAmount as number | undefined;
      const annualSavings = m.annualSavings as number | undefined;
      if (!merchant || firstAmount == null || lastAmount == null || annualSavings == null) return fallback;
      const totalGrowth = (lastAmount - firstAmount) / firstAmount;
      return {
        title: `Subscription price increased significantly: ${merchant}`,
        message: `The price rose ${(totalGrowth * 100).toFixed(0)}% since the first recorded charge (${firstAmount.toFixed(0)} → ${lastAmount.toFixed(0)} ILS). Worth checking whether the service is still used; cancelling would save about ${ilsEn(annualSavings)}/year.`,
        actionText: insight.actionText,
      };
    }
    case "weekly_free_cash": {
      const avgWeeklyDiscretionary = m.avgWeeklyDiscretionary as number | undefined;
      const spentThisWeek = m.spentThisWeek as number | undefined;
      const topCategory = m.topCategory as string | undefined;
      const topCategoryAmount = m.topCategoryAmount as number | undefined;
      const dailyCutSuggestion = m.dailyCutSuggestion as number | undefined;
      if (avgWeeklyDiscretionary == null || spentThisWeek == null) return fallback;
      const freeRemaining = avgWeeklyDiscretionary - spentThisWeek;
      let recommendation = "";
      if (topCategory && topCategoryAmount != null && dailyCutSuggestion != null) {
        recommendation = ` The top category this week is "${topCategory}" (${ilsEn(topCategoryAmount)}) — consider cutting about ${ilsEn(dailyCutSuggestion)}/day for the rest of the week to get back on pace.`;
      }
      return {
        title: "Free spending left this week",
        message:
          `About ${ilsEn(Math.max(0, freeRemaining))} left for free spending this week ` +
          `(out of an average weekly budget of ${ilsEn(avgWeeklyDiscretionary)}, of which ${ilsEn(spentThisWeek)} already spent).` +
          (freeRemaining < 0 ? " You've exceeded the weekly budget." : "") +
          recommendation,
        actionText: insight.actionText,
      };
    }
    case "cashflow_risk": {
      const accountName = m.accountName as string | undefined;
      const currentBalanceEstimate = m.currentBalanceEstimate as number | undefined;
      const projectedNegativeWeek = m.projectedNegativeWeek as string | undefined;
      const projectedBalance = m.projectedBalance as number | undefined;
      if (!accountName || currentBalanceEstimate == null || !projectedNegativeWeek || projectedBalance == null) return fallback;
      const weekLabel = new Date(projectedNegativeWeek).toLocaleDateString("en-US");
      return {
        title: `Risk of negative balance: ${accountName}`,
        message:
          `Based on average income and expenses over the last 6 months, the estimated balance for "${accountName}" ` +
          `is projected to drop below zero around the week of ${weekLabel} (estimated balance: ${ilsEn(projectedBalance)}). ` +
          `The current estimated balance (based on transaction history only) is ${ilsEn(currentBalanceEstimate)}.`,
        actionText: insight.actionText,
      };
    }
    case "idle_cash": {
      const balance = m.balance as number | undefined;
      const movement3mo = m.movement3mo as number | undefined;
      const entityName = insight.entityName ?? (m.entityName as string | undefined);
      if (balance == null || movement3mo == null || !entityName) return fallback;
      return {
        title: `Idle cash surplus — ${entityName}`,
        message:
          `Entity "${entityName}" has an estimated checking balance of about ${ilsEn(balance)} ` +
          `with relatively little movement over the last 3 months (about ${ilsEn(movement3mo)}). ` +
          `Consider moving part of it into the investment portfolio (IBKR) or an interest-bearing deposit/money market fund, keeping a reasonable liquidity cushion in checking.`,
        actionText: insight.actionText,
      };
    }
    case "owner_injection": {
      const businessBalance = m.businessBalance as number | undefined;
      const personalBuffer = m.personalBuffer as number | undefined;
      const suggestedTransfer = m.suggestedTransfer as number | undefined;
      if (businessBalance == null || personalBuffer == null || suggestedTransfer == null) return fallback;
      return {
        title: "Owner capital injection recommended",
        message:
          `The business account balance is estimated at a deficit of about ${ilsEn(Math.abs(businessBalance))}, ` +
          `while the personal account has a surplus above the safety buffer (${ilsEn(personalBuffer)}). ` +
          `A suggested owner injection of about ${ilsEn(suggestedTransfer)} could avoid interest/overdraft fees on the business account.`,
        actionText: insight.actionText,
      };
    }
    default:
      return fallback;
  }
}
