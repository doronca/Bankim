"use client";

import { useEffect, useState } from "react";
import { useAppStore, AGGREGATE } from "@/lib/store";
import { dict } from "@/lib/i18n";
import { translateCategoryName } from "@/lib/categoryTranslations";

interface SubGroup {
  merchant: string;
  category: string | null;
  lastAmount: number;
  previousAmount: number;
  percentIncrease: number | null;
  alert: boolean;
  isRecurring: boolean;
  cadence: string | null;
  isOverridden: boolean;
  occurrences: { date: string; amount: number }[];
}

interface SearchResult {
  merchant: string;
  count: number;
  lastDate: string;
  lastAmount: number;
  category: string | null;
}

const CADENCE_LABELS: Record<string, { he: string; en: string }> = {
  weekly: { he: "שבועי", en: "weekly" },
  biweekly: { he: "דו-שבועי", en: "biweekly" },
  monthly: { he: "חודשי", en: "monthly" },
  bimonthly: { he: "דו-חודשי", en: "bimonthly" },
  quarterly: { he: "רבעוני", en: "quarterly" },
  yearly: { he: "שנתי", en: "yearly" },
};

export default function SubscriptionsPage() {
  const { entity, locale } = useAppStore();
  const t = dict[locale];
  const [groups, setGroups] = useState<SubGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOccasional, setShowOccasional] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  function load() {
    setLoading(true);
    const qs = entity !== AGGREGATE ? `?entity=${entity}` : "";
    fetch(`/api/dashboard/subscriptions${qs}`)
      .then((r) => r.json())
      .then(setGroups)
      .finally(() => setLoading(false));
  }

  useEffect(load, [entity]);

  useEffect(() => {
    const q = searchInput.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const id = setTimeout(() => {
      const qs = new URLSearchParams({ q });
      if (entity !== AGGREGATE) qs.set("entity", entity);
      fetch(`/api/dashboard/subscriptions/search?${qs.toString()}`)
        .then((r) => r.json())
        .then(setSearchResults);
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput, entity]);

  async function setOverride(merchant: string, isSubscription: boolean | null) {
    await fetch("/api/dashboard/subscriptions/override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchant, isSubscription }),
    });
    load();
  }

  const recurring = groups.filter((g) => g.isRecurring);
  const occasional = groups.filter((g) => !g.isRecurring);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{t.subscriptions}</h1>
          <button
            className="text-xs text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1 flex items-center gap-1 hover:bg-slate-50 dark:hover:bg-slate-700 shrink-0"
            onClick={() => load()}
            title={t.refresh}
          >
            <span aria-hidden>⟳</span> {t.refresh}
          </button>
        </div>
        <p className="text-xs text-slate-700 dark:text-slate-400 mt-1">
          {locale === "he"
            ? "רק בתי עסק עם קצב חיוב סדיר (שבועי/חודשי/וכו') נספרים כמנוי. הוצאות חד-פעמיות או בלתי סדירות מופיעות בנפרד למטה. ניתן לתקן סיווג שגוי ידנית."
            : "Only merchants with a regular billing cadence (weekly/monthly/etc.) count as subscriptions. One-off or irregular expenses are listed separately below. Wrong classifications can be corrected manually."}
        </p>
      </div>

      <div className="relative">
        <input
          className="w-full max-w-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-md text-sm px-3 py-1.5"
          placeholder={t.searchMerchantToFlag}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        {searchResults.length > 0 && (
          <div className="absolute z-10 mt-1 w-full max-w-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg overflow-hidden">
            {searchResults.map((r) => (
              <div
                key={r.merchant}
                className="flex items-center justify-between gap-2 px-3 py-2 text-sm border-b border-slate-100 dark:border-slate-700 last:border-0"
              >
                <div className="min-w-0">
                  <div className="truncate text-slate-800 dark:text-slate-100">{r.merchant}</div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-500">
                    {r.count}× · {r.lastAmount.toLocaleString()}
                  </div>
                </div>
                <button
                  className="shrink-0 text-xs bg-primary text-white rounded px-2 py-1"
                  onClick={() => {
                    setOverride(r.merchant, true);
                    setSearchInput("");
                    setSearchResults([]);
                  }}
                >
                  {t.markAsSubscription}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading && <div className="text-slate-600 dark:text-slate-500">…</div>}

      {!loading && (
        <section>
          <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
            {locale === "he" ? `מנויים חוזרים (${recurring.length})` : `Recurring subscriptions (${recurring.length})`}
          </h2>
          {recurring.length === 0 && <div className="text-slate-600 dark:text-slate-500 text-sm">—</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recurring.map((g) => (
              <SubCard key={g.merchant} g={g} locale={locale} t={t} onOverride={setOverride} />
            ))}
          </div>
        </section>
      )}

      {!loading && occasional.length > 0 && (
        <section>
          <button
            className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-1.5"
            onClick={() => setShowOccasional((v) => !v)}
          >
            <span>{showOccasional ? "▾" : "▸"}</span>
            {locale === "he"
              ? `הוצאות חד-פעמיות / בלתי סדירות (${occasional.length})`
              : `One-off / irregular expenses (${occasional.length})`}
          </button>
          {showOccasional && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {occasional.map((g) => (
                <SubCard key={g.merchant} g={g} locale={locale} t={t} onOverride={setOverride} muted />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function SubCard({
  g,
  locale,
  t,
  muted,
  onOverride,
}: {
  g: SubGroup;
  locale: "he" | "en";
  t: (typeof dict)["en"] | (typeof dict)["he"];
  muted?: boolean;
  onOverride: (merchant: string, isSubscription: boolean | null) => void;
}) {
  return (
    <div
      className={`rounded-lg border p-4 bg-white dark:bg-slate-800 ${
        g.alert ? "border-red-300 dark:border-red-800 ring-1 ring-red-200 dark:ring-red-900" : "border-slate-200 dark:border-slate-700"
      } ${muted ? "opacity-70" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium truncate text-slate-800 dark:text-slate-100">{g.merchant}</div>
        <div className="flex gap-1 shrink-0">
          {g.isOverridden && (
            <span className="text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded-full px-2 py-0.5">
              {locale === "he" ? "ידני" : "manual"}
            </span>
          )}
          {g.cadence && (
            <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-400 rounded-full px-2 py-0.5">
              {CADENCE_LABELS[g.cadence]?.[locale] ?? g.cadence}
            </span>
          )}
          {g.alert && (
            <span className="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-full px-2 py-0.5">
              {t.priceIncreaseAlert}
            </span>
          )}
        </div>
      </div>
      <div className="text-xs text-slate-700 dark:text-slate-400 mt-1">{g.category ? translateCategoryName(g.category, locale) : t.uncategorized}</div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-lg font-semibold tabular-nums">{g.lastAmount.toLocaleString()}</span>
        <span className="text-xs text-slate-600 dark:text-slate-500 line-through tabular-nums">
          {g.previousAmount.toLocaleString()}
        </span>
        {g.percentIncrease !== null && (
          <span className={`text-xs tabular-nums ${g.alert ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-400"}`}>
            {(g.percentIncrease * 100).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="text-xs text-slate-600 dark:text-slate-500">
          {g.occurrences.length} {locale === "he" ? "חיובים" : "charges"}
        </div>
        <div className="flex gap-2">
          {g.isOverridden ? (
            <button
              className="text-[11px] text-blue-600 dark:text-blue-400 underline"
              onClick={() => onOverride(g.merchant, null)}
            >
              {t.clearOverride}
            </button>
          ) : g.isRecurring ? (
            <button
              className="text-[11px] text-slate-700 dark:text-slate-400 underline"
              onClick={() => onOverride(g.merchant, false)}
            >
              {t.markNotSubscription}
            </button>
          ) : (
            <button
              className="text-[11px] text-slate-700 dark:text-slate-400 underline"
              onClick={() => onOverride(g.merchant, true)}
            >
              {t.markAsSubscription}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
