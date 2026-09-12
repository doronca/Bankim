"use client";

import { useState } from "react";
import { dict } from "@/lib/i18n";
import type { EntityRow } from "@/lib/useEntities";

export default function EntityManagerModal({
  entities,
  locale,
  onClose,
  onChanged,
}: {
  entities: EntityRow[];
  locale: "he" | "en";
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = dict[locale];
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");

  async function addEntity() {
    if (!newName.trim()) return;
    await fetch("/api/entities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), icon: newIcon.trim() || undefined }),
    });
    setNewName("");
    setNewIcon("");
    onChanged();
  }

  async function saveEdit(id: string) {
    await fetch(`/api/entities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim(), icon: editIcon.trim() || null }),
    });
    setEditingId(null);
    onChanged();
  }

  async function deleteEntity(id: string) {
    if (!confirm(t.deleteEntityConfirm)) return;
    await fetch(`/api/entities/${id}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t.manageEntities}</h2>
          <button
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
          {entities.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-md p-2"
            >
              {editingId === e.id ? (
                <>
                  <input
                    className="w-14 border border-slate-300 dark:border-slate-600 dark:bg-slate-900 rounded px-1.5 py-1 text-sm text-center"
                    value={editIcon}
                    onChange={(ev) => setEditIcon(ev.target.value)}
                    placeholder="🏷️"
                  />
                  <input
                    className="flex-1 border border-slate-300 dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1 text-sm"
                    value={editName}
                    onChange={(ev) => setEditName(ev.target.value)}
                    autoFocus
                  />
                  <button
                    className="text-xs bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white rounded px-2 py-1"
                    onClick={() => saveEdit(e.id)}
                  >
                    {t.save}
                  </button>
                </>
              ) : (
                <>
                  <span className="text-lg">{e.icon ?? "🏷️"}</span>
                  <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">{e.name}</span>
                  <button
                    className="text-xs text-blue-600 dark:text-blue-400"
                    onClick={() => {
                      setEditingId(e.id);
                      setEditName(e.name);
                      setEditIcon(e.icon ?? "");
                    }}
                  >
                    ✎
                  </button>
                  <button
                    className="text-xs text-rose-600"
                    onClick={() => deleteEntity(e.id)}
                  >
                    {t.deleteEntity}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
          <input
            className="w-14 border border-slate-300 dark:border-slate-600 dark:bg-slate-900 rounded px-1.5 py-1.5 text-sm text-center"
            value={newIcon}
            onChange={(e) => setNewIcon(e.target.value)}
            placeholder="🏷️"
          />
          <input
            className="flex-1 border border-slate-300 dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1.5 text-sm"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t.entityName}
            onKeyDown={(e) => e.key === "Enter" && addEntity()}
          />
          <button
            className="text-xs bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white rounded-md px-3 py-1.5"
            onClick={addEntity}
          >
            {t.addEntity}
          </button>
        </div>
      </div>
    </div>
  );
}
