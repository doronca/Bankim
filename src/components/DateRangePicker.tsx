"use client";

import { DATE_RANGE_LABELS } from "@/lib/dateRange";
import type { DateRange, DateRangePreset } from "@/lib/store";

const PRESETS: DateRangePreset[] = [
  "this_month",
  "last_month",
  "last_30_days",
  "last_3_months",
  "last_6_months",
  "custom",
];

export default function DateRangePicker({
  value,
  onChange,
  locale,
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
  locale: "he" | "en";
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className="border border-slate-300 dark:border-slate-600 rounded-md text-sm px-2 py-1.5 bg-white dark:bg-slate-800 dark:text-slate-100"
        value={value.preset}
        onChange={(e) => onChange({ ...value, preset: e.target.value as DateRangePreset })}
      >
        {PRESETS.map((p) => (
          <option key={p} value={p}>
            {DATE_RANGE_LABELS[p][locale]}
          </option>
        ))}
      </select>
      {value.preset === "custom" && (
        <>
          <input
            type="date"
            className="border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-md text-sm px-2 py-1.5"
            value={value.from ?? ""}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
          />
          <span className="text-slate-600 text-sm">{locale === "he" ? "עד" : "to"}</span>
          <input
            type="date"
            className="border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-md text-sm px-2 py-1.5"
            value={value.to ?? ""}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
          />
        </>
      )}
    </div>
  );
}
