"use client";

import { useEffect, useState } from "react";
import { dict } from "@/lib/i18n";
import { translateCategoryName } from "@/lib/categoryTranslations";

interface CategoryRow {
  name: string;
  groupId: string | null;
}

interface GroupRow {
  id: string;
  name: string;
  categories: CategoryRow[];
}

export default function CategoryManagerModal({
  locale,
  onClose,
}: {
  locale: "he" | "en";
  onClose: () => void;
}) {
  const t = dict[locale];
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [ungrouped, setUngrouped] = useState<CategoryRow[]>([]);
  const [newGroupName, setNewGroupName] = useState("");

  function load() {
    Promise.all([
      fetch("/api/category-groups").then((r) => r.json()) as Promise<GroupRow[]>,
      fetch("/api/categories").then((r) => r.json()) as Promise<CategoryRow[]>,
    ]).then(([groupRows, categoryRows]) => {
      setGroups(groupRows);
      setUngrouped(categoryRows.filter((c) => !c.groupId));
    });
  }

  useEffect(load, []);

  async function addGroup() {
    if (!newGroupName.trim()) return;
    await fetch("/api/category-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newGroupName.trim() }),
    });
    setNewGroupName("");
    load();
  }

  async function assignCategory(name: string, groupId: string | null) {
    await fetch(`/api/categories/${encodeURIComponent(name)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId }),
    });
    load();
  }

  async function deleteGroup(id: string) {
    await fetch(`/api/category-groups/${id}`, { method: "DELETE" });
    load();
  }

  const allGroups = groups.map((g) => ({ id: g.id, name: g.name }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg p-5 flex flex-col gap-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t.categoryGroups}</h2>
          <button className="text-slate-600 hover:text-slate-700 dark:hover:text-slate-200" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="flex items-center gap-2">
          <input
            className="flex-1 border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded px-2 py-1.5 text-sm"
            placeholder={t.groupName}
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGroup()}
          />
          <button
            className="text-xs bg-primary text-white rounded-md px-3 py-1.5"
            onClick={addGroup}
          >
            {t.addGroup}
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {groups.map((g) => (
            <div key={g.id} className="border border-slate-200 dark:border-slate-700 rounded-md p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{translateCategoryName(g.name, locale)}</div>
                <button className="text-xs text-rose-600" onClick={() => deleteGroup(g.id)}>
                  {t.deleteEntity}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.categories.map((c) => (
                  <span
                    key={c.name}
                    className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full px-2 py-0.5 flex items-center gap-1"
                  >
                    {translateCategoryName(c.name, locale)}
                    <button
                      className="text-slate-600 hover:text-slate-700 dark:hover:text-slate-200"
                      onClick={() => assignCategory(c.name, null)}
                      title={t.ungrouped}
                    >
                      ✕
                    </button>
                  </span>
                ))}
                {g.categories.length === 0 && (
                  <span className="text-xs text-slate-600 dark:text-slate-500">—</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {ungrouped.length > 0 && (
          <div>
            <div className="text-xs text-slate-700 dark:text-slate-400 mb-1.5">{t.ungrouped}</div>
            <div className="flex flex-col gap-1.5">
              {ungrouped.map((c) => (
                <div key={c.name} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-slate-700 dark:text-slate-200">{translateCategoryName(c.name, locale)}</span>
                  <select
                    className="border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded text-xs px-1.5 py-1"
                    defaultValue=""
                    onChange={(e) => e.target.value && assignCategory(c.name, e.target.value)}
                  >
                    <option value="" disabled>
                      {locale === "he" ? "שייך לקבוצה" : "Assign to group"}
                    </option>
                    {allGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {translateCategoryName(g.name, locale)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
