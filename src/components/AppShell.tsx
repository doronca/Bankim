"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore, AGGREGATE } from "@/lib/store";
import { dict } from "@/lib/i18n";
import EntityManagerModal from "@/components/EntityManagerModal";
import type { EntityRow } from "@/lib/useEntities";
import PreferencesPanel from "@/components/PreferencesPanel";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ScrollToTopButton from "@/components/ScrollToTopButton";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { entity, setEntity, locale, theme, fontSize, sidebarCollapsed, setSidebarCollapsed, showExplanations } = useAppStore();
  const pathname = usePathname();
  const t = dict[locale];
  const mainRef = useRef<HTMLElement>(null);

  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [managerOpen, setManagerOpen] = useState(false);

  function loadEntities() {
    fetch("/api/entities")
      .then((r) => r.json())
      .then(setEntities);
  }

  useEffect(() => {
    loadEntities();
  }, []);

  // A brand-new, single-entity setup has nothing to switch between — hide
  // the dropdown and implicitly select that one entity so every page just
  // shows all data without the user having to think about entities at all.
  useEffect(() => {
    if (entities.length === 0) return;
    if (entities.length === 1 && entity === AGGREGATE) {
      setEntity(entities[0].id);
      return;
    }
    if (entity !== AGGREGATE && !entities.some((e) => e.id === entity)) {
      setEntity(AGGREGATE);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entities]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "he" ? "rtl" : "ltr";
  }, [locale]);

  useEffect(() => {
    const root = document.documentElement;
    const applyDark = (dark: boolean) => root.classList.toggle("dark", dark);
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      applyDark(mq.matches);
      const listener = (e: MediaQueryListEvent) => applyDark(e.matches);
      mq.addEventListener("change", listener);
      return () => mq.removeEventListener("change", listener);
    }
    applyDark(theme === "dark");
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("fs-sm", "fs-md", "fs-lg", "fs-xl");
    root.classList.add(`fs-${fontSize}`);
  }, [fontSize]);

  const navItems: { href: string; label: string; icon: string }[] = [
    { href: "/", label: t.dashboard, icon: "🏠" },
    { href: "/transactions", label: t.transactions, icon: "↔️" },
    { href: "/forecast", label: t.forecast, icon: "📅" },
    { href: "/subscriptions", label: t.subscriptions, icon: "🔁" },
    { href: "/onboarding", label: t.onboarding, icon: "🔗" },
  ];

  const showEntitySwitcher = entities.length > 1;

  return (
    <div className="flex h-screen">
      <aside
        className={`shrink-0 border-e border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col gap-6 overflow-y-auto transition-[width] duration-150 ${
          sidebarCollapsed ? "w-14 p-2" : "w-64 p-4"
        }`}
      >
        <div className={`flex items-center pt-8 ${sidebarCollapsed ? "flex-col gap-2" : "justify-between gap-2"}`}>
          {!sidebarCollapsed && (
            <div className="text-lg font-semibold text-slate-800 dark:text-slate-100 truncate">{t.appTitle}</div>
          )}
          <div className={`flex items-center gap-2 ${sidebarCollapsed ? "flex-col" : "shrink-0"}`}>
            <LanguageSwitcher compact={sidebarCollapsed} />
            <button
              className="shrink-0 w-8 h-8 rounded-md text-slate-600 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? t.expandSidebar : t.collapseSidebar}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <line x1="10" y1="4" x2="10" y2="20" />
              </svg>
            </button>
          </div>
        </div>

        {showEntitySwitcher && !sidebarCollapsed && (
          <div>
            <label className="block text-xs text-slate-700 dark:text-slate-400 mb-1">{t.entitySwitcher}</label>
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <select
                  className="w-full rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 bg-white ps-2 pe-7 py-1.5 text-sm shadow-md shadow-slate-200/70 dark:shadow-none appearance-none"
                  value={entity}
                  onChange={(e) => setEntity(e.target.value)}
                >
                  <option value={AGGREGATE}>{t.aggregate}</option>
                  {entities.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.icon ? `${e.icon} ` : ""}
                      {e.name}
                    </option>
                  ))}
                </select>
                <svg
                  className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-slate-600"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18M12 3c2.5 2.5 4 6 4 9s-1.5 6.5-4 9c-2.5-2.5-4-6-4-9s1.5-6.5 4-9Z" />
                </svg>
              </div>
              <button
                className="shrink-0 w-8 h-8 rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => setManagerOpen(true)}
                title={t.manageEntities}
              >
                ⚙
              </button>
            </div>
          </div>
        )}

        {!showEntitySwitcher && !sidebarCollapsed && (
          <div className="flex flex-col gap-1.5">
            {entities.length === 1 && showExplanations && (
              <div className="text-[11px] text-slate-700 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-md p-2 leading-snug">
                {t.singleEntityHint}
              </div>
            )}
            <button
              className="text-xs text-start text-slate-700 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 underline"
              onClick={() => setManagerOpen(true)}
            >
              {t.manageEntities}
            </button>
          </div>
        )}

        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              title={sidebarCollapsed ? item.label : undefined}
              className={`rounded-md text-sm transition-colors flex items-center gap-2 ${
                sidebarCollapsed ? "justify-center px-0 py-2" : "px-3 py-2"
              } ${
                pathname === item.href
                  ? "bg-primary text-white"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:rounded-lg"
              }`}
            >
              <span>{item.icon}</span>
              {!sidebarCollapsed && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-3">
          {!sidebarCollapsed && (
            <a
              href="/docs/user-guide.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <span>📖</span>
              <span>{t.userGuide}</span>
            </a>
          )}
          {!sidebarCollapsed && <PreferencesPanel locale={locale} />}
        </div>
      </aside>

      <main ref={mainRef} className="flex-1 p-6 overflow-y-auto">
        {children}
      </main>

      <ScrollToTopButton containerRef={mainRef} locale={locale} />

      {managerOpen && (
        <EntityManagerModal
          entities={entities}
          locale={locale}
          onClose={() => setManagerOpen(false)}
          onChanged={loadEntities}
        />
      )}
    </div>
  );
}
