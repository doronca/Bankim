import { endOfMonth, format, startOfMonth, subDays, subMonths } from "date-fns";
import type { DateRange } from "@/lib/store";

// Resolves a DateRange (preset or custom) to concrete from/to ISO dates.
export function resolveDateRange(range: DateRange): { from: string; to: string } {
  const now = new Date();
  switch (range.preset) {
    case "this_month":
      return { from: format(startOfMonth(now), "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
    case "last_month": {
      const lastMonth = subMonths(now, 1);
      return {
        from: format(startOfMonth(lastMonth), "yyyy-MM-dd"),
        to: format(endOfMonth(lastMonth), "yyyy-MM-dd"),
      };
    }
    case "last_30_days":
      return { from: format(subDays(now, 30), "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
    case "last_3_months":
      return { from: format(subMonths(now, 3), "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
    case "last_6_months":
      return { from: format(subMonths(now, 6), "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
    case "custom":
      return { from: range.from ?? format(subMonths(now, 3), "yyyy-MM-dd"), to: range.to ?? format(now, "yyyy-MM-dd") };
  }
}

export const DATE_RANGE_LABELS: Record<DateRange["preset"], { he: string; en: string }> = {
  this_month: { he: "החודש", en: "This month" },
  last_month: { he: "חודש שעבר", en: "Last month" },
  last_30_days: { he: "30 ימים אחרונים", en: "Last 30 days" },
  last_3_months: { he: "3 חודשים אחרונים", en: "Last 3 months" },
  last_6_months: { he: "6 חודשים אחרונים", en: "Last 6 months" },
  custom: { he: "טווח מותאם", en: "Custom" },
};
