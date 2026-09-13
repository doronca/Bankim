"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import type { Locale } from "@/lib/i18n";

export interface DashboardSectionMeta {
  id: string;
  title: string;
}

function GripIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="5" cy="3" r="1.4" />
      <circle cx="11" cy="3" r="1.4" />
      <circle cx="5" cy="8" r="1.4" />
      <circle cx="11" cy="8" r="1.4" />
      <circle cx="5" cy="13" r="1.4" />
      <circle cx="11" cy="13" r="1.4" />
    </svg>
  );
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      className={`shrink-0 transition-transform ${collapsed ? "-rotate-90 rtl:rotate-90" : ""}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

// Drag handle + collapse chevron + "hide" link rendered above every
// customizable dashboard section. Dragging reorders via the section's own
// onDragStart/onDrop handlers, passed down from the page so all sections
// share one drag session.
export function DashboardSectionHeader({
  title,
  collapsed,
  onToggleCollapse,
  onHide,
  locale,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  isDragging,
  isDropTarget,
}: {
  title: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onHide: () => void;
  locale: Locale;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  isDropTarget: boolean;
}) {
  return (
    <div
      className={`group flex items-center gap-1 mb-2 -ms-1 rounded transition border-t-2 ${
        isDropTarget ? "border-primary" : "border-transparent"
      } ${isDragging ? "opacity-40" : ""}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <span
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        role="button"
        aria-label="Drag to reorder"
        title={locale === "he" ? "גררו לשינוי סדר" : "Drag to reorder"}
        className="cursor-grab active:cursor-grabbing select-none p-1.5 rounded text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <GripIcon />
      </span>
      <button
        type="button"
        onClick={onToggleCollapse}
        className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <ChevronIcon collapsed={collapsed} />
        {title}
      </button>
      <button
        type="button"
        onClick={onHide}
        className="ms-1 text-xs text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 underline opacity-0 group-hover:opacity-100 transition"
      >
        {locale === "he" ? "הסתר ממסך הבית" : "Hide from dashboard"}
      </button>
    </div>
  );
}

export default function DashboardCustomizer({
  sections,
  locale,
  onExpandAll,
  onCollapseAll,
}: {
  sections: DashboardSectionMeta[];
  locale: Locale;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}) {
  const { hiddenDashboardSections, setHiddenDashboardSections } = useAppStore();
  const [open, setOpen] = useState(false);

  function toggle(id: string) {
    setHiddenDashboardSections(
      hiddenDashboardSections.includes(id)
        ? hiddenDashboardSections.filter((x) => x !== id)
        : [...hiddenDashboardSections, id]
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onExpandAll}
        className="text-xs rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-slate-600 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500 shrink-0"
      >
        {locale === "he" ? "הרחב הכל" : "Expand all"}
      </button>
      <button
        type="button"
        onClick={onCollapseAll}
        className="text-xs rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-slate-600 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500 shrink-0"
      >
        {locale === "he" ? "כווץ הכל" : "Collapse all"}
      </button>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-slate-600 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500 shrink-0"
        >
          {locale === "he" ? "התאמת תצוגה" : "Customize"}
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute end-0 mt-2 z-50 w-64 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg p-3">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                {locale === "he" ? "מקטעים גלויים בלוח הבקרה" : "Visible dashboard sections"}
              </div>
              <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto">
                {sections.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={!hiddenDashboardSections.includes(s.id)}
                      onChange={() => toggle(s.id)}
                    />
                    {s.title}
                  </label>
                ))}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                {locale === "he" ? "גררו מקטע בעזרת הידית לשינוי סדר" : "Drag a section by its handle to reorder it"}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
