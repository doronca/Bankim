"use client";

import { useEffect, useState } from "react";
import { AGGREGATE, type EntityKey } from "@/lib/store";
import { dict, type Locale } from "@/lib/i18n";

interface Insight {
  id: string;
  entityId: string | null;
  entityName: string | null;
  type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  actionText: string | null;
  amount: number | null;
  computedAt: string;
}

const SEVERITY_STYLES: Record<Insight["severity"], string> = {
  critical: "border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40",
  warning: "border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40",
  info: "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60",
};

export default function InsightsPanel({ entity, locale }: { entity: EntityKey; locale: Locale }) {
  const t = dict[locale];
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [digestText, setDigestText] = useState<string | null>(null);
  const [digestLoading, setDigestLoading] = useState(false);

  function load() {
    setLoading(true);
    const qs = entity !== AGGREGATE ? `?entity=${entity}` : "";
    fetch(`/api/insights${qs}`)
      .then((r) => r.json())
      .then(setInsights)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    setDigestText(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity]);

  async function refresh() {
    setRefreshing(true);
    try {
      await fetch("/api/insights", { method: "POST" });
      load();
    } finally {
      setRefreshing(false);
    }
  }

  async function dismiss(id: string) {
    setInsights((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/insights/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismissed: true }),
    });
  }

  async function copyAction(id: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
  }

  async function generateDigest() {
    if (entity === AGGREGATE) return;
    setDigestLoading(true);
    try {
      const res = await fetch(`/api/insights/digest?entity=${entity}`);
      const data = await res.json();
      setDigestText(data.text ?? null);
    } finally {
      setDigestLoading(false);
    }
  }

  const CARD =
    "bg-white dark:bg-slate-800 rounded-xl border border-slate-200/70 dark:border-slate-700 shadow-sm shadow-slate-200/60 dark:shadow-none p-4";

  return (
    <section className={CARD}>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300">{t.insights}</h2>
        <div className="flex items-center gap-2">
          {entity !== AGGREGATE && (
            <button
              onClick={generateDigest}
              disabled={digestLoading}
              className="text-xs px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              {digestLoading ? t.insightsRefreshing : t.insightsGenerateDigest}
            </button>
          )}
          <button
            onClick={refresh}
            disabled={refreshing}
            className="text-xs px-2.5 py-1 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 disabled:opacity-50"
          >
            {refreshing ? t.insightsRefreshing : t.insightsRefresh}
          </button>
        </div>
      </div>

      {digestText && (
        <div className="mb-4 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <pre className="whitespace-pre-wrap text-xs text-slate-700 dark:text-slate-200 font-sans">{digestText}</pre>
          <button
            onClick={() => navigator.clipboard.writeText(digestText)}
            className="mt-2 text-xs px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            {t.insightsCopyDigest}
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-slate-400 dark:text-slate-500 text-sm">…</div>
      ) : insights.length === 0 ? (
        <div className="text-slate-400 dark:text-slate-500 text-sm">{t.insightsEmpty}</div>
      ) : (
        <div className="flex flex-col gap-2">
          {insights.map((i) => (
            <div key={i.id} className={`rounded-lg border p-3 ${SEVERITY_STYLES[i.severity]}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {i.title}
                    {entity === AGGREGATE && i.entityName && (
                      <span className="ms-2 text-[10px] font-normal text-slate-400 dark:text-slate-500">
                        {i.entityName}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">{i.message}</div>
                </div>
                <button
                  onClick={() => dismiss(i.id)}
                  className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {t.insightsDismiss}
                </button>
              </div>
              {i.actionText && (
                <button
                  onClick={() => copyAction(i.id, i.actionText!)}
                  className="mt-2 text-[11px] px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700"
                >
                  {copiedId === i.id ? t.insightsCopied : t.insightsCopyAction}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
