"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAppStore, AGGREGATE } from "@/lib/store";
import { dict } from "@/lib/i18n";
import { useEntities } from "@/lib/useEntities";
import AskBox from "@/components/AskBox";
import InsightsPanel from "@/components/InsightsPanel";
import TasksPanel from "@/components/TasksPanel";
import CardSettingsButton from "@/components/CardSettingsButton";

interface Summary {
  monthly: Record<string, { income: number; expense: number }>;
  byCategory: Record<string, number>;
  byCategoryGroup: Record<string, number>;
  cards: {
    spendThisMonth: number;
    spendTotal: number;
    predictedNextCharge: number | null;
  };
  netWorth: {
    usd: { positions: number; cash: number; total: number };
    ils: { portfolio: number };
  };
  insights: {
    expenseChangePct: number | null;
    incomeChangePct: number | null;
    topMerchants: { merchant: string; amount: number; count: number; category: string | null }[];
    biggestTransactions: { id: string; date: string; description: string; amount: number; category: string | null }[];
    avgDailyExpense: number;
    savingsRate: number | null;
  };
}

const CARD =
  "bg-white dark:bg-slate-800 rounded-xl border border-slate-200/70 dark:border-slate-700 shadow-sm shadow-slate-200/60 dark:shadow-none p-4";

function formatMonthLabel(monthKey: string, locale: "he" | "en") {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString(locale === "he" ? "he-IL" : "en-US", { month: "short", year: "2-digit" });
}

interface CardForecast {
  id: string;
  name: string;
  nickname: string | null;
  accountNumber: string | null;
  dayOfMonth: number | null;
  isImmediateDebit?: boolean;
  maxChargeAmount?: number | null;
  chargeAmount?: number;
  rolloverAmount?: number;
  entityId: string | null;
  entityName: string | null;
  currency: string;
  pendingAmount: number;
  previousAmount: number | null;
  isEstimate: boolean;
  nextChargeDate: string | null;
  futureTransactionsCount: number;
}

export default function DashboardPage() {
  const { entity, setEntity, locale } = useAppStore();
  const t = dict[locale];
  const { entities } = useEntities();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [categoryGrouped, setCategoryGrouped] = useState(false);
  const [forecastCards, setForecastCards] = useState<CardForecast[]>([]);

  useEffect(() => {
    setLoading(true);
    const qs = entity !== AGGREGATE ? `?entity=${entity}` : "";
    fetch(`/api/dashboard/summary${qs}`)
      .then((r) => r.json())
      .then(setSummary)
      .finally(() => setLoading(false));
  }, [entity]);

  // Fetched unscoped once — grouped by entity client-side to drive the
  // per-entity picker cards below, so switching entities doesn't refetch.
  function loadForecastCards() {
    fetch(`/api/dashboard/forecast`)
      .then((r) => r.json())
      .then((d) => setForecastCards(d.cards ?? []));
  }

  useEffect(loadForecastCards, []);

  if (loading) return <div className="text-slate-500">…</div>;
  if (!summary) return <div className="text-slate-500">No data yet.</div>;

  const monthlyData = Object.entries(summary.monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month: formatMonthLabel(month, locale), [t.income]: v.income, [t.expense]: v.expense }));

  const categoryData = Object.entries(
    categoryGrouped ? summary.byCategoryGroup : summary.byCategory
  ).sort((a, b) => b[1] - a[1]);
  const { insights } = summary;

  const currentEntity = entities.find((e) => e.id === entity);
  const entityLabel = entity === AGGREGATE ? t.aggregate : currentEntity?.name ?? "";
  const title =
    locale === "he" ? `מרכז בקרה פיננסי — ${entityLabel}` : `${entityLabel.toUpperCase()} FINANCIAL COMMAND CENTER`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">{title}</h1>
        {entities.length > 1 && entity !== AGGREGATE && (
          <button
            className="text-xs text-blue-600 dark:text-blue-400 underline shrink-0"
            onClick={() => setEntity(AGGREGATE)}
          >
            {t.showAllEntities}
          </button>
        )}
      </div>

      {entities.length > 1 && entity === AGGREGATE && (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {entities.map((e) => {
            const cards = forecastCards.filter((c) => c.entityId === e.id);
            const pendingTotal = cards.reduce((sum, c) => sum + c.pendingAmount, 0);
            const futureCount = cards.reduce((sum, c) => sum + c.futureTransactionsCount, 0);
            const dates = [...new Set(cards.map((c) => c.nextChargeDate).filter(Boolean))] as string[];
            const isActive = entity === e.id;
            return (
              <button
                key={e.id}
                onClick={() => setEntity(e.id)}
                className={`text-start rounded-xl border p-4 transition ${
                  isActive
                    ? "border-slate-800 dark:border-slate-200 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                    : "border-slate-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-500"
                }`}
              >
                <div className="flex items-center gap-2 font-medium">
                  {e.icon && <span>{e.icon}</span>}
                  <span className="truncate">{e.name}</span>
                </div>
                <div className={`text-[11px] mt-2 ${isActive ? "text-slate-300 dark:text-slate-600" : "text-slate-500 dark:text-slate-400"}`}>
                  {t.pendingAmount}
                </div>
                <div className="text-lg font-bold tabular-nums">
                  {pendingTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div className={`text-[11px] mt-1 flex items-center gap-2 flex-wrap ${isActive ? "text-slate-300 dark:text-slate-600" : "text-slate-500 dark:text-slate-400"}`}>
                  {dates.length > 0 && (
                    <span>
                      {dates
                        .sort()
                        .map((d) => new Date(d).toLocaleDateString(locale === "he" ? "he-IL" : "en-US", { day: "numeric", month: "short" }))
                        .join(" · ")}
                    </span>
                  )}
                  {futureCount > 0 && (
                    <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5">
                      +{futureCount} {t.futureTag}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </section>
      )}

      {(() => {
        const cardsInScope = forecastCards.filter((c) => entity === AGGREGATE || c.entityId === entity);
        if (cardsInScope.length === 0) return null;
        const dateFmt = (d: string) =>
          new Date(d).toLocaleDateString(locale === "he" ? "he-IL" : "en-US", { day: "numeric", month: "short" });
        return (
          <section>
            <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">{t.accountTypeCreditCard}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {cardsInScope.map((card) => {
                const last4 = card.accountNumber?.replace(/[^0-9]/g, "").slice(-4);
                return (
                  <div key={card.id} className={CARD}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{card.name}</div>
                        {last4 && <div className="text-[11px] text-slate-400 dark:text-slate-500">•••• {last4}</div>}
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
                          onSaved={loadForecastCards}
                        />
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {t.pendingAmount}
                        {card.isEstimate && <span className="ms-1 opacity-70">(~)</span>}
                      </div>
                      <div
                        className={`text-lg font-bold tabular-nums ${
                          card.pendingAmount > 0 ? "text-red-600 dark:text-red-400" : "text-slate-400 dark:text-slate-500"
                        }`}
                      >
                        {card.pendingAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} {card.currency}
                      </div>
                      {!!card.rolloverAmount && (
                        <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                          {t.rolloverAmountLabel}: {card.rolloverAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} {card.currency}
                        </div>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 dark:text-slate-500">
                        {card.previousAmount !== null &&
                          `${locale === "he" ? "חיוב קודם" : "Previous"}: ${card.previousAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                      </span>
                      <span className="font-medium text-slate-600 dark:text-slate-300">
                        {card.nextChargeDate ? dateFmt(card.nextChargeDate) : "—"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })()}

      <AskBox entity={entity} locale={locale} />

      <InsightsPanel entity={entity} locale={locale} />

      <TasksPanel entity={entity} locale={locale} />

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <NetWorthCard
          label={`${t.netWorth} (USD)`}
          value={summary.netWorth.usd.total}
          currency="USD"
          icon={<DollarIcon />}
        />
        <NetWorthCard
          label={`${t.netWorth} (ILS ${locale === "he" ? "תיקים" : "portfolios"})`}
          value={summary.netWorth.ils.portfolio}
          currency="ILS"
          icon={<PortfolioIcon />}
        />
        <StatCard
          label={locale === "he" ? "שיעור חיסכון (חודש נוכחי)" : "Savings rate (this month)"}
          value={insights.savingsRate !== null ? `${(insights.savingsRate * 100).toFixed(0)}%` : "—"}
          tone={insights.savingsRate !== null && insights.savingsRate < 0 ? "bad" : "neutral"}
          icon={<RocketIcon />}
        />
        <StatCard
          label={locale === "he" ? "הוצאה יומית ממוצעת" : "Avg daily expense"}
          value={insights.avgDailyExpense.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label={t.cardSpendThisMonth}
          value={summary.cards.spendThisMonth.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          icon={<CreditCardIcon />}
        />
        <StatCard
          label={t.cardSpendTotal}
          value={summary.cards.spendTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          icon={<CreditCardIcon />}
        />
        <div className={`${CARD} relative overflow-hidden`}>
          <div className="text-xs text-slate-500 dark:text-slate-400">{t.predictedNextCharge}</div>
          <div className="text-2xl font-semibold tabular-nums mt-1">
            {summary.cards.predictedNextCharge !== null
              ? summary.cards.predictedNextCharge.toLocaleString(undefined, { maximumFractionDigits: 0 })
              : "—"}
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{t.predictedNextChargeHint}</div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChangeCard
          label={locale === "he" ? "שינוי בהוצאות מול חודש קודם" : "Expense change vs. last month"}
          pct={insights.expenseChangePct}
          goodDirection="down"
          goodColorClass="text-emerald-800"
        />
        <ChangeCard
          label={locale === "he" ? "שינוי בהכנסות מול חודש קודם" : "Income change vs. last month"}
          pct={insights.incomeChangePct}
          goodDirection="up"
          goodColorClass="text-sky-700"
        />
      </section>

      <section className={CARD}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300">{t.cashflow}</h2>
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-600" /> {t.income}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-rose-600" /> {t.expense}
            </span>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" fontSize={12} stroke="#94a3b8" />
              <YAxis fontSize={12} stroke="#94a3b8" />
              <Tooltip
                formatter={(value) => (typeof value === "number" ? value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : value)}
              />
              <Bar dataKey={t.income} fill="#059669" radius={[4, 4, 0, 0]} />
              <Bar dataKey={t.expense} fill="#e11d48" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={CARD}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300">{t.category}</h2>
            <div className="flex text-[11px] rounded-md overflow-hidden border border-slate-200 dark:border-slate-700">
              <button
                className={`px-2 py-1 ${!categoryGrouped ? "bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white" : "text-slate-500 dark:text-slate-400"}`}
                onClick={() => setCategoryGrouped(false)}
              >
                {t.groupByCategory}
              </button>
              <button
                className={`px-2 py-1 ${categoryGrouped ? "bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white" : "text-slate-500 dark:text-slate-400"}`}
                onClick={() => setCategoryGrouped(true)}
              >
                {t.groupByGroup}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {categoryData.length === 0 && <div className="text-slate-400 dark:text-slate-500 text-sm">—</div>}
            {categoryData.map(([cat, amount]) => (
              <div key={cat} className="flex items-center gap-3">
                <div className="w-28 text-sm truncate">{cat}</div>
                <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-700 rounded overflow-hidden">
                  <div
                    className="h-full bg-slate-700 dark:bg-slate-300"
                    style={{ width: `${Math.min(100, (amount / categoryData[0][1]) * 100)}%` }}
                  />
                </div>
                <div className="w-24 text-end text-sm tabular-nums">{amount.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={CARD}>
          <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-3">
            {locale === "he" ? "בתי עסק מובילים (חודש נוכחי)" : "Top merchants (this month)"}
          </h2>
          <div className="flex flex-col gap-2">
            {insights.topMerchants.length === 0 && <div className="text-slate-400 dark:text-slate-500 text-sm">—</div>}
            {insights.topMerchants.map((m) => (
              <div key={m.merchant} className="flex items-center justify-between text-sm">
                <div className="truncate max-w-[60%]">{m.merchant}</div>
                <div className="text-slate-400 dark:text-slate-500 text-xs">{m.count}×</div>
                <div className="tabular-nums">{m.amount.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={CARD}>
        <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-3">
          {locale === "he" ? "התנועות הגדולות ביותר (חודש נוכחי)" : "Biggest transactions (this month)"}
        </h2>
        <div className="flex flex-col gap-2">
          {insights.biggestTransactions.length === 0 && <div className="text-slate-400 dark:text-slate-500 text-sm">—</div>}
          {insights.biggestTransactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between text-sm">
              <div className="truncate max-w-[50%]">{tx.description}</div>
              <div className="text-slate-400 dark:text-slate-500 text-xs">{tx.category ?? t.uncategorized}</div>
              <div className="tabular-nums text-rose-600">{tx.amount.toLocaleString()}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function NetWorthCard({
  label,
  value,
  currency,
  icon,
}: {
  label: string;
  value: number;
  currency: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={`${CARD} relative overflow-hidden`}>
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-2xl font-semibold tabular-nums mt-1">
        {value.toLocaleString(undefined, { maximumFractionDigits: 0 })}{" "}
        <span className="text-sm text-slate-400 dark:text-slate-500">{currency}</span>
      </div>
      <div className="absolute bottom-2 end-2 text-slate-300 dark:text-slate-600">{icon}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone?: "bad" | "neutral";
  icon?: React.ReactNode;
}) {
  return (
    <div className={`${CARD} relative overflow-hidden`}>
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums mt-1 ${tone === "bad" ? "text-rose-600" : ""}`}>
        {value}
      </div>
      {icon && <div className="absolute bottom-2 end-2 text-slate-300 dark:text-slate-600">{icon}</div>}
    </div>
  );
}

function ChangeCard({
  label,
  pct,
  goodDirection,
  goodColorClass,
}: {
  label: string;
  pct: number | null;
  goodDirection: "up" | "down";
  goodColorClass: string;
}) {
  const isGood = pct === null ? null : goodDirection === "up" ? pct >= 0 : pct <= 0;
  return (
    <div className={`${CARD} flex items-center justify-between`}>
      <div className="text-sm text-slate-600 dark:text-slate-300">{label}</div>
      <div
        className={`text-xl font-bold tabular-nums ${
          isGood === null ? "text-slate-400 dark:text-slate-500" : isGood ? goodColorClass : "text-rose-600"
        }`}
      >
        {pct === null ? "—" : `${pct >= 0 ? "+" : ""}${(pct * 100).toFixed(1)}%`}
      </div>
    </div>
  );
}

function DollarIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.5c0-1.1 1.1-2 2.5-2s2.5.7 2.5 1.75-1 1.75-2.5 1.75-2.5.7-2.5 1.75S10.6 15 12 15s2.5-.9 2.5-2" />
    </svg>
  );
}

function PortfolioIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="12" width="3.5" height="8" rx="0.5" />
      <rect x="10.25" y="8" width="3.5" height="12" rx="0.5" />
      <rect x="16.5" y="4" width="3.5" height="16" rx="0.5" />
    </svg>
  );
}

function CreditCardIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h4" />
    </svg>
  );
}

function RocketIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2c3 2 5 6 5 10 0 1.5-.3 3-1 4l-4 4-4-4c-.7-1-1-2.5-1-4 0-4 2-8 5-10Z" />
      <circle cx="12" cy="10" r="1.6" />
      <path d="M8 16l-2 4M16 16l2 4" />
    </svg>
  );
}
