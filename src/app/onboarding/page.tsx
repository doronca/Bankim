"use client";

import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { dict } from "@/lib/i18n";
import { useEntities } from "@/lib/useEntities";
import CategoryManagerModal from "@/components/CategoryManagerModal";
import AccountSettingsPanel from "@/components/AccountSettingsPanel";
import InfoTooltip from "@/components/InfoTooltip";
import SetupGuideModal from "@/components/SetupGuideModal";

type BillingEstimates = Record<string, { dayOfMonth: number; sampleCount: number } | null>;

interface Mapping {
  id: string;
  source: string;
  displayName: string;
  nickname: string | null;
  accountNumber: string | null;
  providerName: string | null;
  accountType: string;
  currency: string;
  entityId: string | null;
  entity: { id: string; name: string; icon: string | null } | null;
  mergedIntoId: string | null;
  mergedInto: { id: string; displayName: string; nickname: string | null } | null;
  billingDayOverride?: number | null;
  isImmediateDebit?: boolean;
  maxChargeAmount?: number | null;
}

interface Provider {
  id: string;
  name: string;
  nameNativeLanguage?: string;
}

export default function OnboardingPage() {
  const { locale } = useAppStore();
  const t = dict[locale];
  const { entities } = useEntities();
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [providers, setProviders] = useState<Provider[]>([]);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [psuId, setPsuId] = useState("");
  const [connectMsg, setConnectMsg] = useState<string | null>(null);
  const [scaLink, setScaLink] = useState<string | null>(null);
  const [pendingConnectionId, setPendingConnectionId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [billingEstimates, setBillingEstimates] = useState<BillingEstimates>({});
  const [pendingAmounts, setPendingAmounts] = useState<Record<string, number>>({});
  const [hideZeroCharge, setHideZeroCharge] = useState(false);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [presetMsg, setPresetMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  type QuickFilter = "all" | "mapped" | "unmapped" | "merged" | "roots" | "credit_card";
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [entityFilter, setEntityFilter] = useState(""); // "" = all, "none" = unassigned, else entity id
  const [syncError, setSyncError] = useState<{ source: "openfinance" | "ibkr"; message: string } | null>(null);
  const [uploadError, setUploadError] = useState(false);
  const [guideSection, setGuideSection] = useState<"general" | "openfinance" | "ibkr" | "fair" | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/account-mappings");
    setMappings(await res.json());
    setLoading(false);
    fetch("/api/account-mappings/billing-estimate")
      .then((r) => r.json())
      .then(setBillingEstimates);
    fetch("/api/dashboard/forecast")
      .then((r) => r.json())
      .then((data: { cards: { id: string; pendingAmount: number }[] }) => {
        setPendingAmounts(Object.fromEntries(data.cards.map((c) => [c.id, c.pendingAmount])));
      });
  }

  useEffect(() => {
    load();
    fetch("/api/openfinance/providers")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setProviders(data);
      })
      .catch((err) => setProvidersError((err as Error).message));
  }, []);

  async function applyPreset(pack: "household" | "business") {
    const res = await fetch("/api/categories/presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pack }),
    });
    const data = await res.json();
    setPresetMsg(
      locale === "he"
        ? `נוספו ${data.groupsCreated} קבוצות ו-${data.categoriesCreated} קטגוריות`
        : `Added ${data.groupsCreated} groups and ${data.categoriesCreated} categories`
    );
  }

  async function startConnection() {
    if (!selectedProvider || !psuId) return;
    setConnecting(true);
    setConnectMsg(null);
    try {
      const res = await fetch("/api/openfinance/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId: selectedProvider, psuId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setScaLink(data.scaOAuth);
      setPendingConnectionId(data.connection?.id ?? null);
    } catch (err) {
      setConnectMsg(`Error: ${(err as Error).message}`);
    } finally {
      setConnecting(false);
    }
  }

  async function finalize() {
    if (!pendingConnectionId) return;
    setFinalizing(true);
    try {
      const res = await fetch("/api/openfinance/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: pendingConnectionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConnectMsg("Connection linked. You can now Sync OpenFinance.");
      setScaLink(null);
      setPendingConnectionId(null);
    } catch (err) {
      setConnectMsg(`Error: ${(err as Error).message}`);
    } finally {
      setFinalizing(false);
    }
  }

  async function assign(id: string, entityId: string) {
    await fetch("/api/account-mappings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, entityId }),
    });
    load();
  }

  async function saveNickname(id: string, nickname: string) {
    await fetch("/api/account-mappings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, nickname }),
    });
    load();
  }

  async function setMerge(id: string, mergedIntoId: string | null) {
    await fetch("/api/account-mappings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, mergedIntoId }),
    });
    load();
  }

  async function runSync(source: "openfinance" | "ibkr") {
    setSyncing(source);
    setSyncError(null);
    try {
      const res = await fetch(`/api/sync/${source}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
    } catch (err) {
      setSyncError({ source, message: (err as Error).message });
    } finally {
      setSyncing(null);
    }
  }

  async function uploadFair(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    setUploadError(false);
    const res = await fetch("/api/upload/fair", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) {
      setUploadMsg(`Error: ${data.error}`);
      setUploadError(true);
    } else {
      setUploadMsg(`Imported ${data.imported} rows`);
      load();
    }
  }

  const unmapped = mappings.filter((m) => !m.entityId);
  const mapped = mappings.filter((m) => m.entityId);

  const query = search.trim().toLowerCase();
  const matchesQuery = (m: Mapping) =>
    !query ||
    [m.displayName, m.nickname, m.accountNumber, m.providerName, m.entity?.name]
      .filter(Boolean)
      .some((field) => field!.toLowerCase().includes(query));

  // "Parent" (root) accounts: ones that have at least one other account
  // merged into them.
  const parentIds = new Set(mappings.filter((m) => m.mergedIntoId).map((m) => m.mergedIntoId!));

  const matchesEntityFilter = (m: Mapping) =>
    !entityFilter || (entityFilter === "none" ? !m.entityId : m.entityId === entityFilter);
  const matchesQuickFilter = (m: Mapping) => {
    switch (quickFilter) {
      case "mapped":
        return Boolean(m.entityId);
      case "unmapped":
        return !m.entityId;
      case "merged":
        return Boolean(m.mergedIntoId);
      case "roots":
        return parentIds.has(m.id);
      case "credit_card":
        return m.accountType === "credit_card";
      default:
        return true;
    }
  };
  const matchesZeroChargeFilter = (m: Mapping) =>
    !hideZeroCharge || m.accountType !== "credit_card" || pendingAmounts[m.id] !== 0;
  const passesFilters = (m: Mapping) =>
    matchesEntityFilter(m) && matchesQuickFilter(m) && matchesQuery(m) && matchesZeroChargeFilter(m);

  // The "merged" and "roots" quick filters are explicitly asking to see just
  // that slice, flat — not nested under an unrelated tree. Everything else
  // (the default "all" and "mapped") keeps the entity → root → merged-children
  // tree, since that's the structure that actually needs untangling.
  const useFlatList = quickFilter === "merged" || quickFilter === "roots" || quickFilter === "credit_card";

  const filteredUnmapped = unmapped.filter(passesFilters);
  const flatFiltered = useFlatList ? mappings.filter(passesFilters) : [];

  // Searching (or the entity filter) can match a merged child without its
  // parent — pull the parent along anyway so the merge relationship stays
  // visible instead of the child floating with no context. But only do this
  // when the parent itself belongs to the filtered entity (or has none) —
  // otherwise an unrelated entity's whole account group leaks into view just
  // because one of its accounts happens to be a merge target.
  const filteredMapped = mapped.filter(passesFilters);
  const parentIdsToKeep = new Set(
    filteredMapped
      .filter((m) => m.mergedIntoId)
      .map((m) => m.mergedIntoId!)
      .filter((parentId) => {
        const parent = mapped.find((p) => p.id === parentId);
        return !parent || matchesEntityFilter(parent);
      })
  );
  const visibleRoots = useFlatList
    ? []
    : mapped.filter((m) => !m.mergedIntoId && (passesFilters(m) || parentIdsToKeep.has(m.id)));
  // Only show every child unconditionally when the root itself genuinely
  // matches the filters. When the root was pulled in merely as context for a
  // matching child (parentIdsToKeep), show just the child(ren) that actually
  // match — otherwise unrelated siblings (e.g. from a different entity) leak
  // into the list alongside the one that matched.
  const childrenOf = (parentId: string, parentMatches: boolean) =>
    mapped.filter((m) => m.mergedIntoId === parentId && (parentMatches || passesFilters(m)));

  const entityGroups = new Map<string, { entity: Mapping["entity"]; roots: Mapping[] }>();
  for (const root of visibleRoots) {
    const key = root.entityId ?? "none";
    if (!entityGroups.has(key)) entityGroups.set(key, { entity: root.entity, roots: [] });
    entityGroups.get(key)!.roots.push(root);
  }

  const quickFilters: { key: QuickFilter; label: string }[] = [
    { key: "all", label: t.filterKindAll },
    { key: "mapped", label: t.filterKindMapped },
    { key: "unmapped", label: t.filterKindUnmapped },
    { key: "merged", label: t.filterKindMerged },
    { key: "roots", label: t.filterKindRoots },
    { key: "credit_card", label: t.filterKindCreditCard },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{t.onboarding}</h1>
        <div className="flex items-center gap-3">
          <a
            className="text-xs text-link dark:text-blue-400 underline"
            href="/docs/user-guide.pdf"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.userGuidePdf}
          </a>
          <button
            className="text-xs text-link dark:text-blue-400 underline"
            onClick={() => setGuideSection("general")}
          >
            {t.setupGuide}
          </button>
        </div>
      </div>

      <section className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-3">
        <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300">
          {locale === "he" ? "חבר חשבון בנק (OpenFinance)" : "Connect a bank account (OpenFinance)"}
        </h2>
        {providersError && (
          <div className="text-xs text-red-600">
            {locale === "he" ? "שגיאה בטעינת רשימת בנקים: " : "Failed to load providers: "}
            {providersError}
          </div>
        )}
        {!providersError && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-md text-sm px-2 py-1.5"
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
            >
              <option value="">{locale === "he" ? "בחר בנק" : "Select bank"}</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {locale === "he" && p.nameNativeLanguage ? p.nameNativeLanguage : p.name}
                </option>
              ))}
            </select>
            <input
              className="border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-md text-sm px-2 py-1.5 w-40"
              placeholder={locale === "he" ? "תעודת זהות" : "National ID"}
              value={psuId}
              onChange={(e) => setPsuId(e.target.value)}
            />
            <button
              className="rounded-md bg-primary text-white text-sm px-3 py-1.5 disabled:opacity-50"
              disabled={!selectedProvider || !psuId || connecting}
              onClick={startConnection}
            >
              {connecting ? "…" : locale === "he" ? "התחל חיבור" : "Start connection"}
            </button>
          </div>
        )}
        {scaLink && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <a
              href={scaLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-link underline"
            >
              {locale === "he" ? "1. פתח והתחבר דרך הבנק" : "1. Open and authenticate with your bank"}
            </a>
            <button
              className="rounded-md bg-primary text-white text-sm px-3 py-1.5 disabled:opacity-50"
              disabled={finalizing}
              onClick={finalize}
            >
              {finalizing
                ? "…"
                : locale === "he"
                ? "2. סיים חיבור"
                : "2. Finalize connection"}
            </button>
          </div>
        )}
        {connectMsg && <div className="text-xs text-slate-700 dark:text-slate-400">{connectMsg}</div>}
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 flex flex-wrap gap-3">
        <button
          className="rounded-md bg-primary text-white text-sm px-3 py-2 disabled:opacity-50"
          disabled={syncing === "openfinance"}
          onClick={() => runSync("openfinance")}
        >
          {syncing === "openfinance" ? "…" : t.syncOpenFinance}
        </button>
        <button
          className="rounded-md bg-primary text-white text-sm px-3 py-2 disabled:opacity-50"
          disabled={syncing === "ibkr"}
          onClick={() => runSync("ibkr")}
        >
          {syncing === "ibkr" ? "…" : t.syncIbkr}
        </button>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xls,.xlsx"
            className="text-sm"
            onChange={(e) => e.target.files?.[0] && uploadFair(e.target.files[0])}
          />
          <span className="text-xs text-slate-700 dark:text-slate-400">{t.uploadFair}</span>
        </div>
        {syncError && (
          <div className="text-xs text-red-600 dark:text-red-400 w-full flex items-center gap-2 flex-wrap">
            <span>{syncError.message}</span>
            <button
              className="text-link dark:text-blue-400 underline shrink-0"
              onClick={() => setGuideSection(syncError.source)}
            >
              {t.setupGuideOpenButton}
            </button>
          </div>
        )}
        {uploadMsg && (
          <div className="text-xs text-slate-700 dark:text-slate-400 w-full flex items-center gap-2 flex-wrap">
            <span>{uploadMsg}</span>
            {uploadError && (
              <button
                className="text-link dark:text-blue-400 underline shrink-0"
                onClick={() => setGuideSection("fair")}
              >
                {t.setupGuideOpenButton}
              </button>
            )}
          </div>
        )}
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300 w-full flex items-center gap-1">
          {t.categories}
          <InfoTooltip text={t.tooltipCategories} />
        </h2>
        <button
          className="rounded-md bg-slate-100 dark:bg-slate-700 dark:text-slate-100 text-sm px-3 py-1.5"
          onClick={() => applyPreset("household")}
        >
          {t.householdPreset}
        </button>
        <button
          className="rounded-md bg-slate-100 dark:bg-slate-700 dark:text-slate-100 text-sm px-3 py-1.5"
          onClick={() => applyPreset("business")}
        >
          {t.businessPreset}
        </button>
        <InfoTooltip text={t.tooltipCategoryPresets} />
        <button
          className="rounded-md border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm px-3 py-1.5"
          onClick={() => setCategoryManagerOpen(true)}
        >
          {t.categoryGroups}
        </button>
        {presetMsg && <div className="text-xs text-slate-700 dark:text-slate-400 w-full">{presetMsg}</div>}
      </section>

      {loading && <div className="text-slate-600 dark:text-slate-500">…</div>}

      {!loading && mappings.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="relative max-w-sm">
            <input
              className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-md text-sm ps-3 pe-8 py-2"
              placeholder={t.searchAccounts}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="absolute end-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-700 dark:hover:text-slate-200"
                onClick={() => setSearch("")}
                title={t.clearSearch}
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md overflow-hidden border border-slate-200 dark:border-slate-700 text-xs">
              {quickFilters.map((f) => (
                <button
                  key={f.key}
                  className={`px-2.5 py-1.5 ${
                    quickFilter === f.key
                      ? "bg-primary text-white"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  }`}
                  onClick={() => setQuickFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <select
              className="border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-md text-xs px-2 py-1.5"
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              title={t.filterByEntity}
            >
              <option value="">{t.allEntitiesOption}</option>
              <option value="none">{t.noEntityOption}</option>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.icon ? `${e.icon} ` : ""}
                  {e.name}
                </option>
              ))}
            </select>
            <label className="text-xs text-slate-700 dark:text-slate-400 flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={hideZeroCharge}
                onChange={(e) => setHideZeroCharge(e.target.checked)}
              />
              {t.hideZeroChargeCards}
            </label>
          </div>
        </div>
      )}

      {!loading && filteredUnmapped.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-red-700 mb-2">
            {t.unmappedAccounts} ({filteredUnmapped.length})
          </h2>
          <div className="flex flex-col gap-2">
            {filteredUnmapped.map((m) => (
              <AccountRow
                key={m.id}
                m={m}
                locale={locale}
                entities={entities}
                borderClass="border-red-200"
                onAssign={assign}
                onNickname={saveNickname}
                placeholderEntity={t.assignEntity}
                billingEstimate={billingEstimates[m.id]}
                t={t}
                allAccounts={mappings}
                onMerge={setMerge}
                onSaved={load}
                entityFilter={entityFilter}
                parentIds={parentIds}
              />
            ))}
          </div>
        </section>
      )}

      {!loading && useFlatList && flatFiltered.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
            {quickFilters.find((f) => f.key === quickFilter)?.label} ({flatFiltered.length})
          </h2>
          <div className="flex flex-col gap-2">
            {flatFiltered.map((m) => (
              <AccountRow
                key={m.id}
                m={m}
                locale={locale}
                entities={entities}
                borderClass="border-slate-200 dark:border-slate-700"
                onAssign={assign}
                onNickname={saveNickname}
                billingEstimate={billingEstimates[m.id]}
                t={t}
                allAccounts={mappings}
                onMerge={setMerge}
                onSaved={load}
                entityFilter={entityFilter}
                parentIds={parentIds}
              />
            ))}
          </div>
        </section>
      )}

      {!loading && !useFlatList && entityGroups.size > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300">{t.accounts}</h2>
          {[...entityGroups.entries()].map(([key, group]) => (
            <details key={key} open className="bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <span className="text-slate-600">📁</span>
                {group.entity?.icon && <span>{group.entity.icon}</span>}
                <span>{group.entity?.name ?? t.unassignedGroup}</span>
                <span className="text-xs text-slate-600 dark:text-slate-500 font-normal">({group.roots.length})</span>
              </summary>
              <div className="flex flex-col gap-2 mt-3 ps-2 border-s-2 border-slate-200 dark:border-slate-700">
                {group.roots.map((root) => {
                  const children = childrenOf(root.id, passesFilters(root));
                  return (
                    <details key={root.id} open={children.length > 0} className="flex flex-col gap-2">
                      <summary className="cursor-pointer list-none flex items-center gap-1.5 -ms-2">
                        <span className="text-slate-300 dark:text-slate-600 text-xs w-4 text-center">
                          {children.length > 0 ? "▾" : "•"}
                        </span>
                        <div className="flex-1">
                          <AccountRow
                            m={root}
                            locale={locale}
                            entities={entities}
                            borderClass="border-slate-200 dark:border-slate-700"
                            onAssign={assign}
                            onNickname={saveNickname}
                            billingEstimate={billingEstimates[root.id]}
                            t={t}
                            allAccounts={mappings}
                            onMerge={setMerge}
                            onSaved={load}
                            entityFilter={entityFilter}
                            parentIds={parentIds}
                          />
                        </div>
                        {children.length > 0 && (
                          <span className="shrink-0 text-[10px] rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5">
                            {children.length} {t.childrenCount}
                          </span>
                        )}
                      </summary>
                      {children.length > 0 && (
                        <div className="flex flex-col gap-2 ms-8 ps-3 border-s-2 border-blue-100 dark:border-blue-900/50 mt-2">
                          {children.map((child) => (
                            <AccountRow
                              key={child.id}
                              m={child}
                              locale={locale}
                              entities={entities}
                              borderClass="border-blue-100 dark:border-blue-900/50"
                              onAssign={assign}
                              onNickname={saveNickname}
                              billingEstimate={billingEstimates[child.id]}
                              t={t}
                              allAccounts={mappings}
                              onMerge={setMerge}
                              onSaved={load}
                              entityFilter={entityFilter}
                              parentIds={parentIds}
                            />
                          ))}
                        </div>
                      )}
                    </details>
                  );
                })}
              </div>
            </details>
          ))}
        </section>
      )}

      {!loading &&
        filteredUnmapped.length === 0 &&
        (useFlatList ? flatFiltered.length === 0 : entityGroups.size === 0) && (
          <div className="text-sm text-slate-600 dark:text-slate-500">{t.noMatchingAccounts}</div>
        )}

      {categoryManagerOpen && (
        <CategoryManagerModal locale={locale} onClose={() => setCategoryManagerOpen(false)} />
      )}

      {guideSection && (
        <SetupGuideModal locale={locale} initialSection={guideSection} onClose={() => setGuideSection(null)} />
      )}
    </div>
  );
}

function AccountRow({
  m,
  locale,
  entities,
  borderClass,
  onAssign,
  onNickname,
  placeholderEntity,
  billingEstimate,
  t,
  allAccounts,
  onMerge,
  onSaved,
  entityFilter,
  parentIds,
}: {
  m: Mapping;
  locale: "he" | "en";
  entities: { id: string; name: string; icon: string | null }[];
  borderClass: string;
  onAssign: (id: string, entityId: string) => void;
  onNickname: (id: string, nickname: string) => void;
  placeholderEntity?: string;
  billingEstimate?: { dayOfMonth: number; sampleCount: number } | null;
  t: (typeof dict)["en"] | (typeof dict)["he"];
  allAccounts: Mapping[];
  onMerge: (id: string, mergedIntoId: string | null) => void;
  onSaved: () => void;
  entityFilter?: string;
  parentIds: Set<string>;
}) {
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState(m.nickname ?? "");

  // An account that already has other accounts merged into it is a merge
  // target itself — merging it into yet another account would create a
  // chain, so it can't be merged.
  const canBeMerged = !parentIds.has(m.id);

  // Only offer accounts that aren't themselves merged into something else
  // (merge chains aren't supported, keep it flat), aren't this one, and are
  // relevant to what's currently on screen: the entity being filtered on, or
  // unassigned accounts (which have no entity to conflict with).
  const matchesFilterOrUnassigned = (a: Mapping) =>
    !entityFilter || !a.entityId || a.entityId === entityFilter;
  const mergeCandidates = allAccounts.filter(
    (a) => a.id !== m.id && !a.mergedIntoId && matchesFilterOrUnassigned(a)
  );

  return (
    <div className={`bg-white dark:bg-slate-800 border ${borderClass} rounded-lg p-3 flex items-center justify-between gap-3`}>
      <div className="min-w-0 flex-1">
        {editingNickname ? (
          <div className="flex items-center gap-1.5 mb-1">
            <input
              className="border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded px-1.5 py-0.5 text-sm w-full"
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              placeholder={m.displayName}
              autoFocus
            />
            <button
              className="text-xs bg-primary text-white rounded px-2 py-1 shrink-0"
              onClick={() => {
                onNickname(m.id, nicknameInput);
                setEditingNickname(false);
              }}
            >
              {locale === "he" ? "שמור" : "Save"}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 mb-0.5">
            <div className="text-sm font-medium break-words text-slate-800 dark:text-slate-100">{m.nickname ?? m.displayName}</div>
            <button
              className="text-[11px] text-link underline shrink-0"
              onClick={() => {
                setNicknameInput(m.nickname ?? "");
                setEditingNickname(true);
              }}
            >
              {locale === "he" ? "כינוי" : "nickname"}
            </button>
            <InfoTooltip text={t.tooltipNickname} />
          </div>
        )}
        {m.nickname && <div className="text-xs text-slate-600 dark:text-slate-500 break-words">{m.displayName}</div>}
        <div className="text-xs text-slate-700 dark:text-slate-400 mt-0.5">
          {[m.providerName, m.accountNumber, m.accountType, m.currency].filter(Boolean).join(" · ")}
        </div>
        {m.accountType === "credit_card" && billingEstimate && (
          <div className="text-xs text-slate-600 dark:text-slate-500 mt-0.5">
            {t.billingDayEstimate}: ~{billingEstimate.dayOfMonth}
          </div>
        )}
        {m.mergedInto ? (
          <div className="text-xs text-link dark:text-blue-400 mt-1 flex items-center gap-1.5">
            {t.mergedInto}: {m.mergedInto.nickname ?? m.mergedInto.displayName}
            <button className="underline" onClick={() => onMerge(m.id, null)}>
              {t.unmerge}
            </button>
            <InfoTooltip text={t.tooltipMerge} />
          </div>
        ) : (
          canBeMerged &&
          mergeCandidates.length > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <select
                className="text-xs border border-slate-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 rounded px-1.5 py-0.5"
                defaultValue=""
                onChange={(e) => e.target.value && onMerge(m.id, e.target.value)}
              >
                <option value="" disabled>
                  {t.mergeAccount}
                </option>
                {mergeCandidates.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nickname ?? a.displayName}
                  </option>
                ))}
              </select>
              <InfoTooltip text={t.tooltipMerge} />
            </div>
          )
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {!m.mergedInto && (
          <select
            className="border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-md text-sm px-2 py-1 shrink-0"
            value={m.entityId ?? ""}
            onChange={(e) => e.target.value && onAssign(m.id, e.target.value)}
          >
            {placeholderEntity && (
              <option value="" disabled>
                {placeholderEntity}
              </option>
            )}
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.icon ? `${e.icon} ` : ""}
                {e.name}
              </option>
            ))}
          </select>
        )}
        <AccountSettingsPanel m={m} entities={entities} allAccounts={allAccounts} locale={locale} onSaved={onSaved} />
      </div>
    </div>
  );
}
