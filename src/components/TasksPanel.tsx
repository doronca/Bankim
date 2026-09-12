"use client";

import { useEffect, useState } from "react";
import { AGGREGATE } from "@/lib/store";
import type { Locale } from "@/lib/i18n";
import { dict } from "@/lib/i18n";
import TaskCard, { type TaskRow } from "@/components/TaskCard";

export default function TasksPanel({ entity, locale }: { entity: string; locale: Locale }) {
  const t = dict[locale];
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    const qs = new URLSearchParams({ status: "open" });
    if (entity !== AGGREGATE) qs.set("entity", entity);
    fetch(`/api/tasks?${qs.toString()}`)
      .then((r) => r.json())
      .then(setTasks)
      .finally(() => setLoading(false));
  }

  useEffect(load, [entity]);

  if (loading) return null;

  return (
    <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/70 dark:border-slate-700 shadow-sm p-4">
      <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-3">{t.tasks}</h2>
      {tasks.length === 0 ? (
        <div className="text-xs text-slate-400 dark:text-slate-500">{t.noOpenTasks}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} locale={locale} onChanged={load} showTransaction />
          ))}
        </div>
      )}
    </section>
  );
}
