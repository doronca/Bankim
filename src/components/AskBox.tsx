"use client";

import { useState } from "react";
import { AGGREGATE, type EntityKey } from "@/lib/store";

interface Message {
  role: "user" | "assistant";
  text: string;
}

export default function AskBox({ entity, locale }: { entity: EntityKey; locale: "he" | "en" }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  async function send() {
    const query = input.trim();
    if (!query) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: query }]);
    setLoading(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          entityId: entity === AGGREGATE ? null : entity,
          locale,
        }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", text: data.reply ?? data.error ?? "…" }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", text: (err as Error).message }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/70 dark:border-slate-700 shadow-sm shadow-slate-200/60 dark:shadow-none p-4 flex flex-col gap-3">
      <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300">
        {locale === "he" ? "שאל / הגדר כלל" : "Ask / set a rule"}
      </h2>

      {messages.length > 0 && (
        <div className="flex flex-col gap-2 max-h-56 overflow-y-auto text-sm">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`whitespace-pre-line rounded-md px-3 py-2 max-w-[85%] ${
                m.role === "user"
                  ? "bg-slate-900 text-white self-end"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 self-start"
              }`}
            >
              {m.text}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-md px-3 py-1.5 text-sm placeholder:text-slate-300 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 focus:border-blue-400"
            placeholder={
              locale === "he"
                ? 'לדוגמה: "כמה הוצאתי על Groceries החודש"'
                : 'e.g. "how much did I spend on Groceries this month"'
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
          {focused && !input && (
            <span className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3 w-px h-4 bg-blue-400 animate-pulse" />
          )}
        </div>
        <button
          className="rounded-md bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white text-sm px-3 py-1.5 disabled:opacity-50"
          disabled={loading || !input.trim()}
          onClick={send}
        >
          {loading ? "…" : locale === "he" ? "שלח" : "Send"}
        </button>
      </div>
      <div className="text-[11px] text-slate-400 dark:text-slate-500">
        {locale === "he"
          ? "מבוסס חוקים קבועים, לא בינה מלאכותית. הקלד \"עזרה\" כדי לראות מה נתמך."
          : "Rule-based, not AI. Type a question or \"help\" to see what's supported."}
      </div>
    </section>
  );
}
