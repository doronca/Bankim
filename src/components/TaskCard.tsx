"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { dict } from "@/lib/i18n";
import InfoTooltip from "@/components/InfoTooltip";
import Ltr from "@/components/Ltr";

export interface TaskNote {
  id: string;
  text: string;
  createdAt: string;
}

export interface TaskRow {
  id: string;
  title: string;
  dueDate: string | null;
  status: "open" | "done";
  snoozedUntil: string | null;
  notes: TaskNote[];
  transaction?: { id: string; description: string; date: string; amount: number; currency: string };
}

// One task with its notes, complete/reopen, snooze, and add-note actions.
// Used both inline on a transaction row and in the dashboard's task list.
export default function TaskCard({
  task,
  locale,
  onChanged,
  showTransaction,
}: {
  task: TaskRow;
  locale: Locale;
  onChanged: () => void;
  showTransaction?: boolean;
}) {
  const t = dict[locale];
  const [noteInput, setNoteInput] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);

  async function patch(body: Record<string, unknown>) {
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    onChanged();
  }

  async function addNote() {
    if (!noteInput.trim()) return;
    await fetch(`/api/tasks/${task.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: noteInput.trim() }),
    });
    setNoteInput("");
    setShowNoteInput(false);
    onChanged();
  }

  async function del() {
    await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    onChanged();
  }

  function snoozeDays(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    patch({ snoozedUntil: d.toISOString() });
  }

  const isDone = task.status === "done";
  const isOverdue = !isDone && task.dueDate && new Date(task.dueDate).getTime() < Date.now();
  const dateFmt = (d: string) => new Date(d).toLocaleDateString(locale === "he" ? "he-IL" : "en-US");

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-md p-2.5 flex flex-col gap-1.5 bg-white dark:bg-slate-900">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`text-sm ${isDone ? "line-through text-slate-600 dark:text-slate-500" : "text-slate-800 dark:text-slate-100"}`}>
            {task.title}
          </div>
          {showTransaction && task.transaction && (
            <div className="text-[11px] text-slate-600 dark:text-slate-500 truncate">
              {task.transaction.description} · <Ltr>{dateFmt(task.transaction.date)}</Ltr>
            </div>
          )}
          <div className="text-[11px] mt-0.5 flex items-center gap-1.5">
            {task.dueDate ? (
              <span className={isOverdue ? "text-red-600 dark:text-red-400 font-medium" : "text-slate-700 dark:text-slate-400"}>
                <Ltr>{dateFmt(task.dueDate)}</Ltr> {isOverdue && `(${t.overdueTask})`}
              </span>
            ) : (
              <span className="text-slate-600 dark:text-slate-500">{t.noDueDate}</span>
            )}
          </div>
        </div>
        <button
          className="shrink-0 text-[11px] text-slate-600 dark:text-slate-500 hover:text-red-500"
          onClick={del}
          title={t.deleteTask}
        >
          ✕
        </button>
      </div>

      {task.notes.length > 0 && (
        <ul className="flex flex-col gap-1 border-s-2 border-slate-100 dark:border-slate-700 ps-2">
          {task.notes.map((n) => (
            <li key={n.id} className="text-[11px] text-slate-600 dark:text-slate-300">
              {n.text}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          className="text-[11px] rounded px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
          onClick={() => patch({ status: isDone ? "open" : "done" })}
        >
          {isDone ? t.reopenTask : t.markDone}
        </button>
        {!isDone && (
          <>
            <button
              className="text-[11px] rounded px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
              onClick={() => snoozeDays(1)}
            >
              {t.snooze}: {t.snoozeUntilTomorrow}
            </button>
            <button
              className="text-[11px] rounded px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
              onClick={() => snoozeDays(7)}
            >
              {t.snoozeUntilNextWeek}
            </button>
            <InfoTooltip text={t.tooltipTaskSnooze} />
          </>
        )}
        <button
          className="text-[11px] text-blue-600 dark:text-blue-400 underline"
          onClick={() => setShowNoteInput((v) => !v)}
        >
          + {t.addTaskNote}
        </button>
      </div>

      {showNoteInput && (
        <div className="flex gap-1.5">
          <input
            className="flex-1 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 rounded px-1.5 py-1 text-xs"
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && addNote()}
          />
          <button className="text-xs bg-primary text-white rounded px-2 py-0.5" onClick={addNote}>
            {t.save}
          </button>
        </div>
      )}
    </div>
  );
}
