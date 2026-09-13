"use client";

import { useAppStore } from "@/lib/store";

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useAppStore();

  return (
    <button
      className={
        compact
          ? "shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-slate-600 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          : "shrink-0 flex items-center gap-1.5 rounded-full bg-white/90 dark:bg-slate-800/90 backdrop-blur border border-slate-200 dark:border-slate-700 shadow-md px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800"
      }
      onClick={() => setLocale(locale === "he" ? "en" : "he")}
      title={locale === "he" ? "Switch to English" : "החלף לעברית"}
    >
      <span>{locale === "he" ? "EN" : "עב"}</span>
    </button>
  );
}
