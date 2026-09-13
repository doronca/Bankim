"use client";

import { useAppStore } from "@/lib/store";

// A small "?" badge that reveals an explanation on hover/focus — used next
// to any control whose purpose isn't obvious from its label alone (merging
// accounts, billing-day detection, revolving credit caps, entities), so the
// app can be learned by poking around rather than needing a manual. Hidden
// entirely when the user turns off "Show explanations" in Preferences.
export default function InfoTooltip({ text }: { text: string }) {
  const showExplanations = useAppStore((s) => s.showExplanations);
  if (!showExplanations) return null;
  return (
    <span className="relative inline-flex group shrink-0">
      <button
        type="button"
        tabIndex={0}
        aria-label={text}
        className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-500 text-[9px] leading-[12px] flex items-center justify-center hover:border-slate-500 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none"
        onClick={(e) => e.preventDefault()}
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full start-1/2 -translate-x-1/2 mb-1.5 w-56 rounded-md bg-slate-800 dark:bg-slate-700 text-white text-[11px] leading-snug px-2 py-1.5 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-opacity z-30 text-start"
      >
        {text}
      </span>
    </span>
  );
}
