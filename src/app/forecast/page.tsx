"use client";

import { useEffect, useRef, useState } from "react";
import { useAppStore, AGGREGATE } from "@/lib/store";
import { dict } from "@/lib/i18n";
import CardSettingsButton from "@/components/CardSettingsButton";

interface CardForecast {
  id: string;
  name: string;
  nickname: string | null;
  entityId: string | null;
  entityName: string | null;
  currency: string;
  pendingAmount: number;
  pendingCount: number;
  isEstimate: boolean;
  nextChargeDate: string | null;
  dayOfMonth: number | null;
  dayOfMonthIsManual: boolean;
  isImmediateDebit?: boolean;
  billingDayRequired?: boolean;
  maxChargeAmount?: number | null;
  chargeAmount?: number;
  rolloverAmount?: number;
  futureTransactionsCount: number;
}

interface ForecastResponse {
  cards: CardForecast[];
  totals: { pendingAmount: number; futureTransactionsCount: number };
}

export default function ForecastPage() {
  const { entity, locale } = useAppStore();
  const t = dict[locale];
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [hideZeroCharge, setHideZeroCharge] = useState(false);
  // Guards against a slower, stale request (e.g. for a previously-selected
  // entity) resolving after a newer one and overwriting its result — without
  // this, switching entities quickly could leave the page showing another
  // entity's cards depending on network timing.
  const requestIdRef = useRef(0);

  function load() {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    const qs = entity !== AGGREGATE ? `?entity=${entity}` : "";
    return fetch(`/api/dashboard/forecast${qs}`)
      .then((r) => r.json())
      .then((json) => {
        if (requestIdRef.current === requestId) setData(json);
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setLoading(false);
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity]);

  if (loading) return <div className="text-slate-700">…</div>;
  if (!data || data.cards.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{t.forecast}</h1>
        <div className="text-sm text-slate-600 dark:text-slate-500">{t.noPendingCharges}</div>
      </div>
    );
  }

  const dateFmt = (d: string) =>
    new Date(d).toLocaleDateString(locale === "he" ? "he-IL" : "en-US", { day: "numeric", month: "short" });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{t.forecast}</h1>
        <p className="text-xs text-slate-700 dark:text-slate-400 mt-1">{t.forecastSubtitle}</p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/70 dark:border-slate-700 shadow-sm p-5 flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-700 dark:text-slate-400">{t.forecastAllCards}</div>
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 tabular-nums mt-1">
            {data.totals.pendingAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
        {data.totals.futureTransactionsCount > 0 && (
          <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 rounded-full px-3 py-1">
            {data.totals.futureTransactionsCount} {t.futureTag}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-slate-600 dark:text-slate-300">{t.perCard}</div>
          <label className="text-xs text-slate-700 dark:text-slate-400 flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={hideZeroCharge}
              onChange={(e) => setHideZeroCharge(e.target.checked)}
            />
            {t.hideZeroChargeCards}
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.cards
            .filter((card) => !hideZeroCharge || card.pendingAmount !== 0)
            .map((card) => (
            <div
              key={card.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/70 dark:border-slate-700 shadow-sm p-4 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-slate-800 dark:text-slate-100 truncate">{card.name}</div>
                  {card.entityName && (
                    <div className="text-[11px] text-slate-600 dark:text-slate-500">{card.entityName}</div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {card.futureTransactionsCount > 0 && (
                    <span className="text-[10px] rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5">
                      +{card.futureTransactionsCount} {t.futureTag}
                    </span>
                  )}
                  <CardSettingsButton
                    cardId={card.id}
                    nickname={card.nickname}
                    billingDay={card.dayOfMonth}
                    isImmediateDebit={card.isImmediateDebit}
                    maxChargeAmount={card.maxChargeAmount}
                    locale={locale}
                    onSaved={load}
                  />
                </div>
              </div>

              <div>
                <div className="text-[11px] text-slate-700 dark:text-slate-400">
                  {t.pendingAmount}
                  {card.isEstimate && <span className="ms-1 opacity-70">(~)</span>}
                </div>
                <div
                  className={`text-xl font-bold tabular-nums ${
                    card.pendingAmount > 0 ? "text-red-600 dark:text-red-400" : "text-slate-600 dark:text-slate-500"
                  }`}
                >
                  {card.pendingAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} {card.currency}
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-500">
                  {card.pendingAmount === 0 && !card.isEstimate
                    ? t.noPendingCharges
                    : `${card.pendingCount} ${t.pendingTransactionsCount}`}
                </div>
                {!!card.rolloverAmount && (
                  <div className="mt-1.5 flex items-center justify-between text-[11px] bg-amber-50 dark:bg-amber-900/20 rounded px-2 py-1">
                    <span className="text-slate-700 dark:text-slate-400">{t.chargeAmountLabel}</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {card.chargeAmount?.toLocaleString(undefined, { maximumFractionDigits: 0 })} {card.currency}
                    </span>
                  </div>
                )}
                {!!card.rolloverAmount && (
                  <div className="flex items-center justify-between text-[11px] px-2">
                    <span className="text-amber-600 dark:text-amber-400">{t.rolloverAmountLabel}</span>
                    <span className="font-medium text-amber-600 dark:text-amber-400">
                      {card.rolloverAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} {card.currency}
                    </span>
                  </div>
                )}
              </div>

              {!card.isImmediateDebit && (
                <div className="border-t border-slate-100 dark:border-slate-700 pt-2 flex items-center justify-between">
                  <span className="text-[11px] text-slate-700 dark:text-slate-400">{t.nextChargeDate}</span>
                  {card.nextChargeDate ? (
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {dateFmt(card.nextChargeDate)}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-600 dark:text-slate-500">{t.nextChargeUnknown}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
