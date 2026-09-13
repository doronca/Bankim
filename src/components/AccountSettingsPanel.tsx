"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { dict } from "@/lib/i18n";
import InfoTooltip from "@/components/InfoTooltip";

const SUGGESTED_DAYS = [2, 10, 15, 20];

interface Mapping {
  id: string;
  displayName: string;
  nickname: string | null;
  accountType: string;
  entityId: string | null;
  mergedIntoId: string | null;
  billingDayOverride?: number | null;
  isImmediateDebit?: boolean;
  maxChargeAmount?: number | null;
}

// The single, discoverable entry point to every setting an account/card can
// have — nickname, entity, merge target, and (for credit cards) billing day,
// debit flag, and revolving-credit cap. Previously these were scattered
// across an always-visible inline nickname editor, an inline merge <select>,
// and — for billing/debit/cap — a completely different screen (the
// Forecast page's card settings), which made most of a card's settings
// undiscoverable from onboarding. One gear button now opens all of it.
export default function AccountSettingsPanel({
  m,
  entities,
  allAccounts,
  locale,
  onSaved,
}: {
  m: Mapping;
  entities: { id: string; name: string; icon: string | null }[];
  allAccounts: Mapping[];
  locale: Locale;
  onSaved: () => void;
}) {
  const t = dict[locale];
  const [open, setOpen] = useState(false);
  const [nicknameInput, setNicknameInput] = useState(m.nickname ?? "");
  const [entityInput, setEntityInput] = useState(m.entityId ?? "");
  const [mergeInput, setMergeInput] = useState(m.mergedIntoId ?? "");
  const [dayInput, setDayInput] = useState(m.billingDayOverride ? String(m.billingDayOverride) : "");
  const [debitInput, setDebitInput] = useState(m.isImmediateDebit ?? false);
  const [maxChargeInput, setMaxChargeInput] = useState(m.maxChargeAmount ? String(m.maxChargeAmount) : "");
  const [showOtherDay, setShowOtherDay] = useState(
    !!m.billingDayOverride && !SUGGESTED_DAYS.includes(m.billingDayOverride)
  );

  const isCard = m.accountType === "credit_card";
  const mergeCandidates = allAccounts.filter((a) => a.id !== m.id && !a.mergedIntoId);

  function reset() {
    setNicknameInput(m.nickname ?? "");
    setEntityInput(m.entityId ?? "");
    setMergeInput(m.mergedIntoId ?? "");
    setDayInput(m.billingDayOverride ? String(m.billingDayOverride) : "");
    setDebitInput(m.isImmediateDebit ?? false);
    setMaxChargeInput(m.maxChargeAmount ? String(m.maxChargeAmount) : "");
    setShowOtherDay(!!m.billingDayOverride && !SUGGESTED_DAYS.includes(m.billingDayOverride));
  }

  async function save() {
    const day = isCard && !debitInput && dayInput.trim() ? Number(dayInput) : null;
    if (day !== null && (day < 1 || day > 31)) return;
    const maxCharge = isCard && maxChargeInput.trim() ? Number(maxChargeInput) : null;
    if (maxCharge !== null && (!Number.isFinite(maxCharge) || maxCharge <= 0)) return;

    await fetch("/api/account-mappings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: m.id,
        nickname: nicknameInput,
        entityId: entityInput || null,
        mergedIntoId: mergeInput || null,
        ...(isCard
          ? { billingDayOverride: day, isImmediateDebit: debitInput, maxChargeAmount: maxCharge }
          : {}),
      }),
    });
    setOpen(false);
    onSaved();
  }

  return (
    <div className="relative shrink-0">
      <button
        className="text-[11px] rounded-md border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 px-2 py-1 flex items-center gap-1"
        onClick={() => {
          reset();
          setOpen((v) => !v);
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
        </svg>
        {t.accountSettings}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute end-0 top-8 z-40 w-72 max-h-[70vh] overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-xl p-3 flex flex-col gap-3">
            <div className="text-[11px] font-medium text-slate-700 dark:text-slate-400 truncate">
              {t.allSettingsFor} {m.nickname ?? m.displayName}
            </div>

            <label className="text-[11px] text-slate-700 dark:text-slate-400 flex flex-col gap-1">
              <span className="flex items-center gap-1">
                {t.cardNickname}
                <InfoTooltip text={t.tooltipNickname} />
              </span>
              <input
                className="border border-slate-300 dark:border-slate-600 dark:bg-slate-900 rounded px-1.5 py-1 text-xs"
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                placeholder={m.displayName}
                autoFocus
              />
            </label>

            <label className="text-[11px] text-slate-700 dark:text-slate-400 flex flex-col gap-1">
              <span className="flex items-center gap-1">
                {t.filterByEntity}
                <InfoTooltip text={t.tooltipEntityAssign} />
              </span>
              <select
                className="border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded px-1.5 py-1 text-xs"
                value={entityInput}
                onChange={(e) => setEntityInput(e.target.value)}
              >
                <option value="">{t.noEntityOption}</option>
                {entities.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.icon ? `${e.icon} ` : ""}
                    {e.name}
                  </option>
                ))}
              </select>
            </label>

            {mergeCandidates.length > 0 && (
              <label className="text-[11px] text-slate-700 dark:text-slate-400 flex flex-col gap-1">
                <span className="flex items-center gap-1">
                  {t.mergeAccount}
                  <InfoTooltip text={t.tooltipMerge} />
                </span>
                <select
                  className="border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded px-1.5 py-1 text-xs"
                  value={mergeInput}
                  onChange={(e) => setMergeInput(e.target.value)}
                >
                  <option value="">{locale === "he" ? "לא ממוזג" : "Not merged"}</option>
                  {mergeCandidates.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nickname ?? a.displayName}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {isCard && (
              <>
                <label className="text-[11px] text-slate-700 dark:text-slate-400 flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-700">
                  <input
                    type="checkbox"
                    checked={debitInput}
                    onChange={(e) => setDebitInput(e.target.checked)}
                  />
                  <span className="flex items-center gap-1">
                    {t.isImmediateDebitLabel}
                    <InfoTooltip text={t.tooltipImmediateDebit} />
                  </span>
                </label>

                {!debitInput && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-slate-700 dark:text-slate-400 flex items-center gap-1">
                      {t.setBillingDay}
                      <InfoTooltip text={t.tooltipBillingDay} />
                    </span>
                    {!m.billingDayOverride && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400">{t.billingDayRequiredHint}</span>
                    )}
                    <div className="flex gap-1 flex-wrap">
                      {SUGGESTED_DAYS.map((d) => (
                        <button
                          key={d}
                          type="button"
                          className={`text-xs rounded px-2 py-1 border ${
                            !showOtherDay && dayInput === String(d)
                              ? "bg-primary text-white border-primary"
                              : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 dark:text-slate-200"
                          }`}
                          onClick={() => {
                            setDayInput(String(d));
                            setShowOtherDay(false);
                          }}
                        >
                          {d}
                        </button>
                      ))}
                      <button
                        type="button"
                        className={`text-xs rounded px-2 py-1 border ${
                          showOtherDay
                            ? "bg-primary text-white border-primary"
                            : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 dark:text-slate-200"
                        }`}
                        onClick={() => setShowOtherDay(true)}
                      >
                        {t.billingDayOther}
                      </button>
                    </div>
                    {showOtherDay && (
                      <input
                        type="number"
                        min={1}
                        max={31}
                        className="border border-slate-300 dark:border-slate-600 dark:bg-slate-900 rounded px-1.5 py-1 text-xs"
                        value={dayInput}
                        onChange={(e) => setDayInput(e.target.value)}
                        placeholder="1-31"
                      />
                    )}
                  </div>
                )}

                {!debitInput && (
                  <label className="text-[11px] text-slate-700 dark:text-slate-400 flex flex-col gap-1">
                    <span className="flex items-center gap-1">
                      {t.maxChargeAmountLabel}
                      <InfoTooltip text={t.tooltipMaxCharge} />
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      className="border border-slate-300 dark:border-slate-600 dark:bg-slate-900 rounded px-1.5 py-1 text-xs"
                      value={maxChargeInput}
                      onChange={(e) => setMaxChargeInput(e.target.value)}
                      placeholder={t.maxChargeAmountPlaceholder}
                    />
                  </label>
                )}
              </>
            )}

            <div className="flex gap-1.5 justify-end pt-1">
              <button
                className="text-xs bg-slate-200 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1"
                onClick={() => setOpen(false)}
              >
                {t.cancel}
              </button>
              <button className="text-xs bg-primary text-white rounded px-2 py-1" onClick={save}>
                {t.save}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
