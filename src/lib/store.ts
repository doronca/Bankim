import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Locale } from "@/lib/i18n";

// An entity id from the Entity table, or the "aggregate" pseudo-entity that
// means "show everything, unfiltered."
export type EntityKey = string;
export const AGGREGATE: EntityKey = "aggregate";

export type DateRangePreset =
  | "this_month"
  | "last_month"
  | "last_30_days"
  | "last_3_months"
  | "last_6_months"
  | "custom";

export interface DateRange {
  preset: DateRangePreset;
  from: string | null; // ISO date, only meaningful for "custom"
  to: string | null;
}

export type Theme = "light" | "dark" | "system";
export type FontSize = "sm" | "md" | "lg" | "xl";

interface AppState {
  entity: EntityKey;
  setEntity: (e: EntityKey) => void;
  locale: Locale;
  setLocale: (l: Locale) => void;
  transactionsDateRange: DateRange;
  setTransactionsDateRange: (r: DateRange) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  fontSize: FontSize;
  setFontSize: (s: FontSize) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  // Global toggle for the "?" explanation tooltips and inline hints sprinkled
  // across the app. On by default so the app is learnable by exploring it;
  // a user who's past that can turn it off from Preferences to declutter.
  showExplanations: boolean;
  setShowExplanations: (v: boolean) => void;
  // Dashboard section customization: order of section ids, ids hidden from
  // view, and ids currently collapsed. Sections not yet present in `order`
  // (e.g. newly added ones) are appended at render time, not stored here.
  dashboardSectionOrder: string[];
  setDashboardSectionOrder: (order: string[]) => void;
  hiddenDashboardSections: string[];
  setHiddenDashboardSections: (ids: string[]) => void;
  collapsedDashboardSections: string[];
  setCollapsedDashboardSections: (ids: string[]) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      entity: AGGREGATE,
      setEntity: (entity) => set({ entity }),
      locale: "he",
      setLocale: (locale) => set({ locale }),
      transactionsDateRange: { preset: "last_3_months", from: null, to: null },
      setTransactionsDateRange: (transactionsDateRange) => set({ transactionsDateRange }),
      theme: "system",
      setTheme: (theme) => set({ theme }),
      fontSize: "md",
      setFontSize: (fontSize) => set({ fontSize }),
      sidebarCollapsed: false,
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      showExplanations: true,
      setShowExplanations: (showExplanations) => set({ showExplanations }),
      dashboardSectionOrder: [],
      setDashboardSectionOrder: (dashboardSectionOrder) => set({ dashboardSectionOrder }),
      hiddenDashboardSections: [],
      setHiddenDashboardSections: (hiddenDashboardSections) => set({ hiddenDashboardSections }),
      collapsedDashboardSections: [],
      setCollapsedDashboardSections: (collapsedDashboardSections) => set({ collapsedDashboardSections }),
    }),
    { name: "app-store" }
  )
);
