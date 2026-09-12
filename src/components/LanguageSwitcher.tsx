"use client";

import { useAppStore } from "@/lib/store";

// Fixed at the top corner matching reading direction: top-right for Hebrew
// (RTL), top-left for English (LTR) — i.e. always the "start" corner.
export default function LanguageSwitcher() {
  const { locale, setLocale } = useAppStore();

  return (
    <button
      className="fixed top-3 start-3 z-40 flex items-center gap-1.5 rounded-full bg-white/90 dark:bg-slate-800/90 backdrop-blur border border-slate-200 dark:border-slate-700 shadow-md px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800"
      onClick={() => setLocale(locale === "he" ? "en" : "he")}
      title={locale === "he" ? "Switch to English" : "החלף לעברית"}
    >
      <span>{locale === "he" ? "🇺🇸" : "🇮🇱"}</span>
      <span>{locale === "he" ? "English" : "עברית"}</span>
    </button>
  );
}
