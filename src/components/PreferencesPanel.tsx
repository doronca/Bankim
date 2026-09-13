"use client";

import { useAppStore, type FontSize, type Theme } from "@/lib/store";
import { dict } from "@/lib/i18n";

const THEME_OPTIONS: Theme[] = ["light", "dark", "system"];
const FONT_OPTIONS: FontSize[] = ["sm", "md", "lg", "xl"];

export default function PreferencesPanel({ locale }: { locale: "he" | "en" }) {
  const { theme, setTheme, fontSize, setFontSize, showExplanations, setShowExplanations } = useAppStore();
  const t = dict[locale];

  const themeLabels: Record<Theme, string> = {
    light: t.themeLight,
    dark: t.themeDark,
    system: t.themeSystem,
  };
  const fontLabels: Record<FontSize, string> = {
    sm: t.fontSizeSm,
    md: t.fontSizeMd,
    lg: t.fontSizeLg,
    xl: t.fontSizeXl,
  };

  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="text-slate-400 dark:text-slate-500 font-medium">{t.preferences}</div>

      <div>
        <div className="text-slate-500 dark:text-slate-400 mb-1">{t.theme}</div>
        <div className="flex gap-1">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt}
              className={`flex-1 rounded-md px-1.5 py-1 border text-[11px] ${
                theme === opt
                  ? "bg-blue-800 text-white border-blue-800"
                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
              onClick={() => setTheme(opt)}
            >
              {themeLabels[opt]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-slate-500 dark:text-slate-400 mb-1">{t.fontSize}</div>
        <div className="flex gap-1">
          {FONT_OPTIONS.map((opt) => (
            <button
              key={opt}
              className={`flex-1 rounded-md px-1 py-1 border text-[11px] ${
                fontSize === opt
                  ? "bg-blue-800 text-white border-blue-800"
                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
              onClick={() => setFontSize(opt)}
            >
              {opt.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 cursor-pointer">
        <input
          type="checkbox"
          checked={showExplanations}
          onChange={(e) => setShowExplanations(e.target.checked)}
        />
        {t.showExplanationsLabel}
      </label>
    </div>
  );
}
