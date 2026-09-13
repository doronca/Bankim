"use client";

import { Fragment, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAppStore, AGGREGATE } from "@/lib/store";
import { dict } from "@/lib/i18n";
import { translateCategoryName } from "@/lib/categoryTranslations";
import { resolveDateRange } from "@/lib/dateRange";
import { currencySymbol } from "@/lib/currency";
import DateRangePicker from "@/components/DateRangePicker";
import TaskCard, { type TaskRow } from "@/components/TaskCard";
import InfoTooltip from "@/components/InfoTooltip";

interface Tx {
  id: string;
  date: string;
  amount: number;
  currency: string;
  description: string;
  additionalInfo: string | null;
  category: string | null;
  note: string | null;
  accountMapping: {
    id: string;
    displayName: string;
    nickname: string | null;
    entity: { id: string; name: string } | null;
    mergedInto: { displayName: string; nickname: string | null } | null;
  };
  matchedCard: { id: string; name: string; manual: boolean } | null;
}

interface AccountOption {
  id: string;
  displayName: string;
  nickname: string | null;
  entityId: string | null;
  accountType: "bank_account" | "credit_card" | "investment_portfolio";
  mergedIntoId: string | null;
}

type Scope = "single" | "entity" | "global";
type Sign = "" | "income" | "expense";
type AccountType = "" | "bank_account" | "credit_card" | "investment_portfolio";

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="text-slate-700 dark:text-slate-300">…</div>}>
      <TransactionsPageInner />
    </Suspense>
  );
}

function TransactionsPageInner() {
  const { entity, locale, transactionsDateRange, setTransactionsDateRange } = useAppStore();
  const t = dict[locale];
  const searchParams = useSearchParams();
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryInput, setCategoryInput] = useState("");
  const [scope, setScope] = useState<Scope>("entity");
  const [rememberDefault, setRememberDefault] = useState(false);

  const [categoryFilter, setCategoryFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState(() => searchParams.get("accountId") ?? "");
  const [accountTypeFilter, setAccountTypeFilter] = useState<AccountType>("");
  const [signFilter, setSignFilter] = useState<Sign>("");
  const [hideFuture, setHideFuture] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [allAccounts, setAllAccounts] = useState<AccountOption[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState("");

  const [linkingTxId, setLinkingTxId] = useState<string | null>(null);

  async function setLinkedCard(txId: string, linkedCardId: string | null) {
    await fetch(`/api/transactions/${txId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkedCardId }),
    });
    setLinkingTxId(null);
    reload();
  }

  const [tasksByTx, setTasksByTx] = useState<Record<string, TaskRow[]>>({});
  const [expandedTasksTxId, setExpandedTasksTxId] = useState<string | null>(null);
  const [expandedInfoTxId, setExpandedInfoTxId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDue, setNewTaskDue] = useState("");

  function loadTasks() {
    const qs = new URLSearchParams({ status: "all" });
    if (entity !== AGGREGATE) qs.set("entity", entity);
    fetch(`/api/tasks?${qs.toString()}`)
      .then((r) => r.json())
      .then((rows: TaskRow[]) => {
        const map: Record<string, TaskRow[]> = {};
        for (const row of rows) {
          const txId = row.transaction?.id;
          if (!txId) continue;
          (map[txId] ??= []).push(row);
        }
        setTasksByTx(map);
      });
  }

  useEffect(loadTasks, [entity]);

  async function addTask(txId: string) {
    if (!newTaskTitle.trim()) return;
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId: txId, title: newTaskTitle.trim(), dueDate: newTaskDue || null }),
    });
    setNewTaskTitle("");
    setNewTaskDue("");
    loadTasks();
  }

  // Only accounts belonging to the selected entity (or all, in aggregate
  // view), and never an account that's been merged into another one — those
  // should only ever appear under their merge target's name.
  const accounts = useMemo(
    () =>
      allAccounts.filter(
        (a) => !a.mergedIntoId && (entity === AGGREGATE || a.entityId === entity)
      ),
    [allAccounts, entity]
  );

  // Reset filters that no longer make sense once the entity/account list changes.
  // Guarded on allAccounts being loaded — otherwise this fires on first render
  // (before the account list has been fetched) and clears an accountId passed
  // in via the URL before it ever gets a chance to match.
  useEffect(() => {
    if (allAccounts.length === 0) return;
    if (accountFilter && !accounts.some((a) => a.id === accountFilter)) setAccountFilter("");
  }, [accounts, accountFilter, allAccounts]);

  // A running balance only makes sense scoped to one account, so default to
  // the entity's single checking account when there is exactly one — that's
  // the common case, and it means most people see a balance without having
  // to know to pick an account first. Anyone can still switch to "all
  // accounts" manually.
  useEffect(() => {
    if (accountFilter || accountTypeFilter) return;
    const bankAccounts = accounts.filter((a) => a.accountType === "bank_account");
    if (bankAccounts.length === 1) setAccountFilter(bankAccounts[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts]);

  // Date-range presets (e.g. "last 3 months") describe how far back to look,
  // not a future cutoff — without this, transactions dated ahead of today
  // (post-dated checks, standing orders already posted by the bank) would
  // silently vanish because `to` from the preset never exceeds "now". Future
  // transactions stay visible up to a fixed forward window unless the user
  // explicitly asks to hide them.
  const FUTURE_WINDOW_DAYS = 60;

  async function load() {
    setLoading(true);
    const { from, to } = resolveDateRange(transactionsDateRange);
    const futureTo = new Date();
    futureTo.setDate(futureTo.getDate() + FUTURE_WINDOW_DAYS);
    const effectiveTo = hideFuture ? to : [to, futureTo.toISOString().slice(0, 10)].sort().at(-1)!;
    const params = new URLSearchParams({ from, to: effectiveTo });
    if (entity !== AGGREGATE) params.set("entity", entity);
    if (categoryFilter) params.set("category", categoryFilter);
    if (accountFilter) params.set("accountId", accountFilter);
    if (accountTypeFilter) params.set("accountType", accountTypeFilter);
    if (signFilter) params.set("sign", signFilter);
    if (searchFilter) params.set("search", searchFilter);
    if (hideFuture) params.set("hideFuture", "1");
    const res = await fetch(`/api/transactions?${params.toString()}`);
    return res.json() as Promise<Tx[]>;
  }

  useEffect(() => {
    // Guards against an earlier request (e.g. the pre-hydration default
    // range) resolving after a later one and clobbering fresher data.
    let stale = false;
    load().then((data) => {
      if (stale) return;
      setTransactions(data);
      setLoading(false);
    });
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, transactionsDateRange, categoryFilter, accountFilter, accountTypeFilter, signFilter, searchFilter, hideFuture]);

  useEffect(() => {
    fetch("/api/settings?key=defaultRecategorizeScope")
      .then((r) => r.json())
      .then((d) => {
        if (d.value === "single" || d.value === "entity" || d.value === "global") setScope(d.value);
      });
    fetch("/api/account-mappings")
      .then((r) => r.json())
      .then((rows: AccountOption[]) => setAllAccounts(rows));
  }, []);

  useEffect(() => {
    const qs = entity !== AGGREGATE ? `?entity=${entity}` : "";
    fetch(`/api/transactions/categories${qs}`)
      .then((r) => r.json())
      .then((rows: string[]) => setCategoryOptions(rows));
  }, [entity]);

  // Debounce the free-text search.
  useEffect(() => {
    const id = setTimeout(() => setSearchFilter(searchInput.trim()), 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  function startEdit(tx: Tx) {
    setEditingId(tx.id);
    setCategoryInput(tx.category ?? "");
  }

  async function reload() {
    setLoading(true);
    const data = await load();
    setTransactions(data);
    setLoading(false);
  }

  async function saveCategory(id: string) {
    await fetch(`/api/transactions/${id}/recategorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: categoryInput, scope }),
    });
    if (rememberDefault) {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "defaultRecategorizeScope", value: scope }),
      });
    }
    setEditingId(null);
    reload();
  }

  async function saveNote(id: string) {
    await fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: noteInput }),
    });
    setEditingNoteId(null);
    reload();
  }

  const scopeLabels: Record<Scope, { he: string; en: string }> = {
    single: { he: "רק תנועה זו", en: "Just this transaction" },
    entity: { he: "בית עסק זה, בישות הזו", en: "This merchant, this entity" },
    global: { he: "בית עסק זה, בכל הישויות", en: "This merchant, everywhere" },
  };

  const hasFilters =
    categoryFilter || accountFilter || accountTypeFilter || signFilter || searchFilter || hideFuture;

  // A running balance is only meaningful once the list is scoped to a single
  // account — otherwise transactions from unrelated accounts (in different
  // currencies, even) would be summed together meaninglessly. It's a
  // cumulative total of the transactions shown, not a synced bank balance.
  const showRunningBalance = Boolean(accountFilter);
  const runningBalances = useMemo(() => {
    if (!showRunningBalance) return null;
    // transactions are sorted desc by date; walk from oldest to newest.
    const ascending = [...transactions].reverse();
    let total = 0;
    const map = new Map<string, number>();
    for (const tx of ascending) {
      total += tx.amount;
      map.set(tx.id, total);
    }
    return map;
  }, [transactions, showRunningBalance]);

  const now = Date.now();
  const currency = transactions[0]?.currency ?? "ILS";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{t.transactions}</h1>
        <div className="flex items-center gap-2">
          <DateRangePicker value={transactionsDateRange} onChange={setTransactionsDateRange} locale={locale} />
          <button
            className="text-xs text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1.5 flex items-center gap-1 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
            onClick={() => reload()}
            disabled={loading}
            title={t.refresh}
          >
            <span aria-hidden>⟳</span> {t.refresh}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-md text-sm px-2 py-1.5 min-w-[200px]"
          placeholder={t.searchTransactions}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select
          className="border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-md text-sm px-2 py-1.5"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">{t.allCategories}</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>
              {translateCategoryName(c, locale)}
            </option>
          ))}
        </select>
        <select
          className="border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-md text-sm px-2 py-1.5 max-w-[200px]"
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value)}
        >
          <option value="">{t.allAccounts}</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nickname ?? a.displayName}
            </option>
          ))}
        </select>
        <select
          className="border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-md text-sm px-2 py-1.5"
          value={accountTypeFilter}
          onChange={(e) => setAccountTypeFilter(e.target.value as AccountType)}
        >
          <option value="">{t.allAccountTypes}</option>
          <option value="bank_account">{t.accountTypeBank}</option>
          <option value="credit_card">{t.accountTypeCreditCard}</option>
          <option value="investment_portfolio">{t.accountTypeInvestment}</option>
        </select>
        <select
          className="border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-md text-sm px-2 py-1.5"
          value={signFilter}
          onChange={(e) => setSignFilter(e.target.value as Sign)}
        >
          <option value="">{t.allDirections}</option>
          <option value="income">{t.incomeOnly}</option>
          <option value="expense">{t.expenseOnly}</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 px-1">
          <input type="checkbox" checked={hideFuture} onChange={(e) => setHideFuture(e.target.checked)} />
          {t.hideFuture}
        </label>
        {hasFilters && (
          <button
            className="text-xs text-blue-600 dark:text-blue-400 underline"
            onClick={() => {
              setCategoryFilter("");
              setAccountFilter("");
              setAccountTypeFilter("");
              setSignFilter("");
              setSearchFilter("");
              setSearchInput("");
              setHideFuture(false);
            }}
          >
            {t.clearFilters}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {!loading && (
          <div className="text-xs text-slate-600 dark:text-slate-500">
            {transactions.length} {locale === "he" ? "תנועות" : "transactions"}
          </div>
        )}
        {showRunningBalance ? (
          <div className="text-xs text-slate-700 dark:text-slate-400" title={t.runningBalanceHint}>
            {t.runningBalance}:{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
              {(runningBalances?.get(transactions[0]?.id) ?? 0).toLocaleString()} {currencySymbol(currency)}
            </span>
          </div>
        ) : (
          <div className="text-xs text-slate-600 dark:text-slate-500">{t.selectSingleAccountForBalance}</div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-400 text-start">
            <tr>
              <th className="text-start px-3 py-2 font-medium">{t.date}</th>
              <th className="text-start px-3 py-2 font-medium">{t.merchant}</th>
              <th className="text-start px-3 py-2 font-medium">
                <span className="flex items-center gap-1">
                  {t.category}
                  <InfoTooltip text={t.tooltipAutoRule} />
                </span>
              </th>
              <th className="text-start px-3 py-2 font-medium">Account</th>
              <th className="text-start px-3 py-2 font-medium">
                <span className="flex items-center gap-1">
                  {t.note}
                  <InfoTooltip text={t.tooltipNote} />
                </span>
              </th>
              <th className="text-start px-3 py-2 font-medium">
                <span className="flex items-center gap-1">
                  {t.tasks}
                  <InfoTooltip text={t.tooltipTask} />
                </span>
              </th>
              <th className="text-end px-3 py-2 font-medium">{t.amount}</th>
              {showRunningBalance && <th className="text-end px-3 py-2 font-medium">{t.balance}</th>}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={showRunningBalance ? 8 : 7} className="px-3 py-6 text-center text-slate-600 dark:text-slate-500">…</td>
              </tr>
            )}
            {!loading && transactions.length === 0 && (
              <tr>
                <td colSpan={showRunningBalance ? 8 : 7} className="px-3 py-6 text-center text-slate-600 dark:text-slate-500">—</td>
              </tr>
            )}
            {transactions.map((tx) => {
              const isFuture = new Date(tx.date).getTime() > now;
              return (
              <Fragment key={tx.id}>
              <tr className="border-t border-slate-100 dark:border-slate-700 align-top">
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    {new Date(tx.date).toLocaleDateString(locale === "he" ? "he-IL" : "en-US")}
                    {isFuture && (
                      <span className="text-[10px] rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5">
                        {t.futureTag}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 max-w-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="truncate">{tx.description}</span>
                    {tx.matchedCard && linkingTxId !== tx.id && (
                      <button
                        className="shrink-0 text-[10px] rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                        title={
                          tx.matchedCard.manual
                            ? locale === "he"
                              ? "שויך ידנית — לחץ להצגת תנועות הכרטיס, או שנה שיוך"
                              : "Linked manually — click to show this card's transactions, or change the link"
                            : locale === "he"
                            ? "חיוב של הכרטיס הזה — הצג את תנועותיו, או תקן אם זה לא נכון"
                            : "This card's charge — show its transactions, or fix if wrong"
                        }
                        onClick={() => setAccountFilter(tx.matchedCard!.id)}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setLinkingTxId(tx.id);
                        }}
                      >
                        💳 {tx.matchedCard.name}
                        {!tx.matchedCard.manual && <span className="opacity-60 ms-0.5">(~)</span>}
                      </button>
                    )}
                    {tx.accountMapping.entity &&
                      !tx.matchedCard &&
                      linkingTxId !== tx.id &&
                      allAccounts.some(
                        (a) => a.accountType === "credit_card" && !a.mergedIntoId && a.entityId === tx.accountMapping.entity!.id
                      ) && (
                        <button
                          className="shrink-0 text-[10px] rounded-full text-slate-600 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-600 px-1.5 py-0.5 hover:bg-slate-50 dark:hover:bg-slate-700"
                          onClick={() => setLinkingTxId(tx.id)}
                        >
                          + {locale === "he" ? "שייך לכרטיס" : "Link to card"}
                        </button>
                      )}
                    {linkingTxId === tx.id && (
                      <span className="flex items-center gap-1">
                        <select
                          className="text-[11px] border border-slate-300 dark:border-slate-600 dark:bg-slate-900 rounded px-1 py-0.5"
                          autoFocus
                          defaultValue={tx.matchedCard?.manual ? tx.matchedCard.id : ""}
                          onChange={(e) => setLinkedCard(tx.id, e.target.value || null)}
                        >
                          <option value="">{locale === "he" ? "בחר כרטיס…" : "Choose card…"}</option>
                          {allAccounts
                            .filter(
                              (a) =>
                                a.accountType === "credit_card" &&
                                !a.mergedIntoId &&
                                a.entityId === (tx.accountMapping.entity?.id ?? null)
                            )
                            .map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.nickname ?? a.displayName}
                              </option>
                            ))}
                        </select>
                        <button
                          className="text-[11px] text-slate-600 dark:text-slate-400"
                          onClick={() => setLinkingTxId(null)}
                        >
                          {t.cancel}
                        </button>
                      </span>
                    )}
                    {tx.additionalInfo && (
                      <button
                        className="shrink-0 text-slate-600 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs leading-none"
                        title={tx.additionalInfo}
                        onClick={() => setExpandedInfoTxId(expandedInfoTxId === tx.id ? null : tx.id)}
                      >
                        {expandedInfoTxId === tx.id ? "−" : "+"}
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {editingId === tx.id ? (
                    <div className="flex flex-col gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md p-2 w-64">
                      <input
                        className="border border-slate-300 dark:border-slate-600 dark:bg-slate-800 rounded px-1.5 py-1 text-xs"
                        value={categoryInput}
                        onChange={(e) => setCategoryInput(e.target.value)}
                        list="category-options"
                        autoFocus
                      />
                      <div className="flex flex-col gap-1">
                        {(["single", "entity", "global"] as Scope[]).map((s) => (
                          <label key={s} className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                            <input
                              type="radio"
                              name={`scope-${tx.id}`}
                              checked={scope === s}
                              onChange={() => setScope(s)}
                            />
                            {scopeLabels[s][locale]}
                          </label>
                        ))}
                      </div>
                      <label className="flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-400">
                        <input
                          type="checkbox"
                          checked={rememberDefault}
                          onChange={(e) => setRememberDefault(e.target.checked)}
                        />
                        {locale === "he" ? "זכור כברירת מחדל" : "Remember as default"}
                      </label>
                      <div className="flex gap-1.5">
                        <button
                          className="text-xs bg-primary text-white rounded px-2 py-1"
                          onClick={() => saveCategory(tx.id)}
                        >
                          {t.save}
                        </button>
                        <button
                          className="text-xs bg-slate-200 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1"
                          onClick={() => setEditingId(null)}
                        >
                          {t.cancel}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="text-xs rounded-full bg-slate-100 dark:bg-slate-700 dark:text-slate-200 px-2 py-0.5 hover:bg-slate-200 dark:hover:bg-slate-600"
                      onClick={() => startEdit(tx)}
                    >
                      {tx.category ? translateCategoryName(tx.category, locale) : t.uncategorized}
                    </button>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-700 dark:text-slate-400">
                  {tx.accountMapping.mergedInto
                    ? tx.accountMapping.mergedInto.nickname ?? tx.accountMapping.mergedInto.displayName
                    : tx.accountMapping.nickname ?? tx.accountMapping.displayName}
                </td>
                <td className="px-3 py-2 max-w-[160px]">
                  {editingNoteId === tx.id ? (
                    <div className="flex flex-col gap-1.5">
                      <input
                        className="border border-slate-300 dark:border-slate-600 dark:bg-slate-900 rounded px-1.5 py-1 text-xs w-full"
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && saveNote(tx.id)}
                      />
                      <div className="flex gap-1.5">
                        <button
                          className="text-xs bg-primary text-white rounded px-2 py-0.5"
                          onClick={() => saveNote(tx.id)}
                        >
                          {t.save}
                        </button>
                        <button
                          className="text-xs bg-slate-200 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-0.5"
                          onClick={() => setEditingNoteId(null)}
                        >
                          {t.cancel}
                        </button>
                      </div>
                    </div>
                  ) : tx.note ? (
                    <button
                      className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-[150px] block underline decoration-dotted"
                      title={t.editNote}
                      onClick={() => {
                        setEditingNoteId(tx.id);
                        setNoteInput(tx.note ?? "");
                      }}
                    >
                      {tx.note}
                    </button>
                  ) : (
                    <button
                      className="text-xs text-slate-600 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                      onClick={() => {
                        setEditingNoteId(tx.id);
                        setNoteInput("");
                      }}
                    >
                      + {t.addNote}
                    </button>
                  )}
                </td>
                <td className="px-3 py-2 max-w-[220px]">
                  {(() => {
                    const rowTasks = tasksByTx[tx.id] ?? [];
                    const openTasks = rowTasks.filter((task) => task.status === "open");
                    const soonestDue = openTasks
                      .map((task) => task.dueDate)
                      .filter((d): d is string => Boolean(d))
                      .sort()[0];
                    return (
                      <div className="flex flex-col gap-1.5">
                        <button
                          className={`text-xs rounded-full px-2 py-0.5 self-start ${
                            rowTasks.length > 0
                              ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                              : "text-slate-600 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                          }`}
                          onClick={() => setExpandedTasksTxId(expandedTasksTxId === tx.id ? null : tx.id)}
                        >
                          {rowTasks.length > 0
                            ? `${openTasks.length}/${rowTasks.length} ${t.tasks}${soonestDue ? " · " + new Date(soonestDue).toLocaleDateString(locale === "he" ? "he-IL" : "en-US") : ""}`
                            : `+ ${t.addTask}`}
                        </button>
                        {expandedTasksTxId === tx.id && (
                          <div className="flex flex-col gap-2 w-64">
                            {rowTasks.map((task) => (
                              <TaskCard key={task.id} task={task} locale={locale} onChanged={loadTasks} />
                            ))}
                            <div className="flex flex-col gap-1 border border-dashed border-slate-300 dark:border-slate-600 rounded-md p-2">
                              <input
                                className="border border-slate-300 dark:border-slate-600 dark:bg-slate-900 rounded px-1.5 py-1 text-xs"
                                placeholder={t.taskTitle}
                                value={newTaskTitle}
                                onChange={(e) => setNewTaskTitle(e.target.value)}
                              />
                              <input
                                type="date"
                                className="border border-slate-300 dark:border-slate-600 dark:bg-slate-900 rounded px-1.5 py-1 text-xs"
                                value={newTaskDue}
                                onChange={(e) => setNewTaskDue(e.target.value)}
                              />
                              <button
                                className="text-xs bg-primary text-white rounded px-2 py-1"
                                onClick={() => addTask(tx.id)}
                              >
                                {t.addTask}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </td>
                <td
                  className={`px-3 py-2 text-end tabular-nums whitespace-nowrap ${
                    tx.amount < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                  }`}
                >
                  {tx.amount.toLocaleString()} {currencySymbol(tx.currency)}
                </td>
                {showRunningBalance && (
                  <td className="px-3 py-2 text-end tabular-nums whitespace-nowrap text-slate-600 dark:text-slate-300">
                    {(runningBalances?.get(tx.id) ?? 0).toLocaleString()}
                  </td>
                )}
              </tr>
              {expandedInfoTxId === tx.id && tx.additionalInfo && (
                <tr className="bg-slate-50 dark:bg-slate-900/40">
                  <td></td>
                  <td colSpan={showRunningBalance ? 7 : 6} className="px-3 py-1.5 text-xs text-slate-700 dark:text-slate-400">
                    {tx.additionalInfo}
                  </td>
                </tr>
              )}
              </Fragment>
            );})}
          </tbody>
        </table>
      </div>

      <datalist id="category-options">
        {categoryOptions.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </div>
  );
}
