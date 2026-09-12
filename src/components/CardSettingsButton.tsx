"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { dict } from "@/lib/i18n";

// A small gear button on a credit-card cube/cell that opens an inline form
// for the two things about a card that aren't detected automatically:
// its nickname, and (when the billing-day heuristic can't find one) a
// manual billing day. Used on both the dashboard's card cubes and the
// Forecast page's card cards.
export default function CardSettingsButton({
  cardId,
  nickname,
  billingDay,
  locale,
  onSaved,
}: {
  cardId: string;
  nickname: string | null;
  billingDay: number | null;
  locale: Locale;
  onSaved: () => void;
}) {
  const t = dict[locale];
  const [open, setOpen] = useState(false);
  const [nicknameInput, setNicknameInput] = useState(nickname ?? "");
  const [dayInput, setDayInput] = useState(billingDay ? String(billingDay) : "");

  async function save() {
    const day = dayInput.trim() ? Number(dayInput) : null;
    if (day !== null && (day < 1 || day > 31)) return;
    await fetch("/api/account-mappings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cardId, nickname: nicknameInput, billingDayOverride: day }),
    });
    setOpen(false);
    onSaved();
  }

  return (
    <div className="relative shrink-0">
      <button
        className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
        title={t.cardSettings}
        onClick={() => {
          setNicknameInput(nickname ?? "");
          setDayInput(billingDay ? String(billingDay) : "");
          setOpen((v) => !v);
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute end-0 top-7 z-20 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg p-3 flex flex-col gap-2">
            <label className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-col gap-1">
              {t.cardNickname}
              <input
                className="border border-slate-300 dark:border-slate-600 dark:bg-slate-900 rounded px-1.5 py-1 text-xs"
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                autoFocus
              />
            </label>
            <label className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-col gap-1">
              {t.setBillingDay}
              <input
                type="number"
                min={1}
                max={31}
                className="border border-slate-300 dark:border-slate-600 dark:bg-slate-900 rounded px-1.5 py-1 text-xs"
                value={dayInput}
                onChange={(e) => setDayInput(e.target.value)}
                placeholder={locale === "he" ? "1-31" : "1-31"}
              />
            </label>
            <div className="flex gap-1.5 justify-end">
              <button
                className="text-xs bg-slate-200 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1"
                onClick={() => setOpen(false)}
              >
                {t.cancel}
              </button>
              <button className="text-xs bg-slate-900 text-white rounded px-2 py-1" onClick={save}>
                {t.save}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
