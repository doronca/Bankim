"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { dict } from "@/lib/i18n";

type Section = "general" | "openfinance" | "ibkr" | "fair";

// Explains the one thing the onboarding screen's sync/upload errors can't:
// *how* to fix a missing-credentials or bad-file error, since that lives in
// a .env file the UI has no business editing itself. Opened either from the
// "Setup guide" link or directly from an error's own "open guide" button,
// scrolled to the relevant section.
export default function SetupGuideModal({
  locale,
  initialSection = "general",
  onClose,
}: {
  locale: Locale;
  initialSection?: Section;
  onClose: () => void;
}) {
  const t = dict[locale];
  const [section, setSection] = useState<Section>(initialSection);

  const sections: { key: Section; title: string; body: string }[] = [
    { key: "general", title: t.setupGuideGeneralTitle, body: t.setupGuideGeneralBody },
    { key: "openfinance", title: t.setupGuideOpenFinanceTitle, body: t.setupGuideOpenFinanceBody },
    { key: "ibkr", title: t.setupGuideIbkrTitle, body: t.setupGuideIbkrBody },
    { key: "fair", title: t.setupGuideFairTitle, body: t.setupGuideFairBody },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg p-5 flex flex-col gap-3 max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t.setupGuide}</h2>
          <button className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {sections.map((s) => (
            <button
              key={s.key}
              className={`text-xs rounded-md px-2.5 py-1.5 ${
                section === s.key
                  ? "bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
              }`}
              onClick={() => setSection(s.key)}
            >
              {s.title}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex flex-col gap-3 pt-1">
          {sections
            .filter((s) => s.key === section)
            .map((s) => (
              <div key={s.key}>
                <h3 className="text-sm font-medium text-slate-800 dark:text-slate-100 mb-1.5">{s.title}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                  {s.body}
                </p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
