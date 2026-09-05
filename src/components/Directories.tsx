"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useConvexAuth, useQueries, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ChevronRight, Search } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { MemberAvatar } from "@/components/MemberAvatar";
import { CreateTabMenu } from "@/components/CreateTabMenu";
import { NewExpenseButton } from "@/components/NewExpenseButton";
import { useExpenseList } from "@/lib/expenseSync";
import { computeSplit } from "@/lib/calculations";
import { currency } from "@/lib/format";

function Directory({ title, description, action, children }: { title: string; description: string; action?: ReactNode; children: ReactNode }) {
  return <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 md:px-10 md:py-12">
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-2 text-sm text-ink-soft">{description}</p></div>
      {action}
    </header>
    {children}
  </main>;
}

function Notice({ children }: { children: ReactNode }) {
  return <p role="status" className="rounded-xl border border-dashed border-rule bg-surface/60 px-6 py-10 text-center text-sm text-ink-soft">{children}</p>;
}

const directoryListClass = "divide-y divide-rule/70 overflow-hidden rounded-xl border border-rule/70 bg-surface/80";
const directoryRowClass = "group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-4 px-5 py-6 transition-colors hover:bg-[#f3ead8] focus-visible:bg-[#f3ead8] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest sm:grid-cols-[minmax(0,1fr)_minmax(0,auto)_auto] sm:px-6";

export function TabsDirectory() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const tabs = useQuery(api.tabs.list, isAuthenticated ? {} : "skip");
  return <Directory title="Tabs" description="Your tabs, all in one place." action={<CreateTabMenu variant="primary" />}>
    {isLoading || (isAuthenticated && tabs === undefined) ? <Notice>Loading tabs…</Notice> : !isAuthenticated ? <Notice>Sign in to create a tab or see the tabs you belong to.</Notice> : !tabs?.length ? <Notice>No tabs yet. Create a tab to start splitting expenses together.</Notice> :
      <ul className={directoryListClass}>
        {tabs.map(tab => <TabDirectoryRow key={tab.slug} tab={tab} />)}
      </ul>}
  </Directory>;
}

function TabDirectoryRow({ tab }: { tab: FunctionReturnType<typeof api.tabs.list>[number] }) {
  const detail = useQuery(api.tabs.getBySlug, { slug: tab.slug });
  const expenses = useQuery(api.tabs.expensesForTab, { slug: tab.slug });
  // Keep different currencies separate instead of adding incompatible totals.
  const totals = new Map<string, number>();
  for (const expense of expenses ?? []) {
    totals.set(expense.currency, (totals.get(expense.currency) ?? 0) + computeSplit(expense.people, expense.items).grandTotal);
  }
  return <li>
    <Link href={`/t/${tab.slug}`} className={directoryRowClass}>
      <div className="min-w-0">
        <h2 className="font-display text-lg font-semibold break-words">{tab.name}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label={`${tab.memberCount} ${tab.memberCount === 1 ? "member" : "members"}`}>
          {detail === undefined ? <span className="text-sm text-ink-soft">Loading members…</span> : detail?.members.map(member => <MemberAvatar key={member.id} id={member.resolvedId} name={member.name} />)}
          <span className="ml-2 text-xs text-ink-soft">{tab.memberCount} {tab.memberCount === 1 ? "member" : "members"}</span>
        </div>
      </div>
      <div className="col-start-1 row-start-2 flex flex-wrap items-center justify-between gap-3 text-sm sm:col-start-2 sm:row-start-1 sm:flex-col sm:items-end sm:gap-2">
        <span className="text-ink-soft">{expenses === undefined ? "Loading expenses…" : `${expenses.length} ${expenses.length === 1 ? "expense" : "expenses"}`}</span>
        <span className="flex flex-wrap gap-x-3 gap-y-1 font-numeric font-semibold sm:flex-col sm:items-end">
          {[...totals].sort(([a], [b]) => a.localeCompare(b)).map(([code, total]) => <span key={code}>{currency(total, code)}</span>)}
          {expenses?.length === 0 && detail && <span>{currency(0, detail.defaultCurrency)}</span>}
        </span>
      </div>
      <ChevronRight aria-hidden="true" className="col-start-2 row-start-1 h-5 w-5 text-ink-soft transition group-hover:translate-x-0.5 sm:col-start-3" />
    </Link>
  </li>;
}

export function ExpensesDirectory() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const tabs = useQuery(api.tabs.list, isAuthenticated ? {} : "skip");
  const ownRemote = useQuery(api.expenses.list, isAuthenticated ? {} : "skip");
  const localExpenses = useExpenseList();
  const [search, setSearch] = useState("");
  const queries = useMemo(() => Object.fromEntries((tabs ?? []).map(tab => [tab.slug, { query: api.tabs.expensesForTab, args: { slug: tab.slug } }])), [tabs]);
  const results = useQueries(queries);
  const loading = isLoading || (isAuthenticated && (tabs === undefined || ownRemote === undefined || (tabs ?? []).some(tab => results[tab.slug] === undefined)));
  const failed = (tabs ?? []).some(tab => results[tab.slug] instanceof Error);
  const own = isAuthenticated ? ownRemote ?? [] : localExpenses;
  const rows = own.map(({ slug, state }) => ({ key: `own-${slug}`, slug, name: state.name, items: state.items, people: state.people, currency: state.currency, updatedAt: "updatedAt" in state ? Number(state.updatedAt) : 0, tabName: "Personal expense", href: `/e/${slug}` }));
  for (const tab of tabs ?? []) {
    const expenses = results[tab.slug] as FunctionReturnType<typeof api.tabs.expensesForTab> | Error | undefined;
    if (!expenses || expenses instanceof Error) continue;
    for (const expense of expenses) {
      // An owned expense appears once, with its tab name. Shared expenses
      // open the tab's existing read-only view, not the owner-only editor.
      const owned = tab.isOwner ? rows.find(row => row.slug === expense.slug) : undefined;
      if (owned) owned.tabName = tab.name;
      else rows.push({ ...expense, key: `${tab.slug}-${expense.slug}`, name: expense.name ?? "Untitled expense", tabName: tab.name, href: `/t/${tab.slug}` });
    }
  }
  rows.sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name));
  const filtered = rows.filter(row => `${row.name} ${row.tabName}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <Directory title="Expenses" description="All your expenses across all tabs, together in one place." action={<NewExpenseButton variant="primary" />}>
    <label className="mb-5 flex items-center gap-3 rounded-lg border border-rule bg-surface px-4 py-3 focus-within:border-forest focus-within:ring-2 focus-within:ring-forest/20">
      <Search className="h-4 w-4 text-ink-soft" /><input aria-label="Search expenses or tabs" placeholder="Search expenses or tabs…" value={search} onChange={event => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
    </label>
    {loading ? <Notice>Loading expenses…</Notice> : failed ? <Notice>Some expenses couldn’t be loaded. Please refresh to try again.</Notice> : !filtered.length ? <Notice>{rows.length ? "No expenses match your search." : "No expenses yet. Split an expense to get started."}</Notice> :
      <ul className={directoryListClass}>{filtered.map(row => <li key={row.key}>
        <Link href={row.href} className={directoryRowClass}>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold break-words">{row.name}</h2>
            <p className="mt-1 text-sm text-ink-soft break-words">{row.tabName}</p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label={`${row.people.length} participants`}>
              {row.people.map(person => <MemberAvatar key={person.id} id={person.id} name={person.name} />)}
              <span className="ml-2 text-xs text-ink-soft">{row.people.length} {row.people.length === 1 ? "person" : "people"}</span>
            </div>
          </div>
          <div className="col-start-1 row-start-2 flex flex-wrap items-center justify-between gap-3 text-sm sm:col-start-2 sm:row-start-1 sm:flex-col sm:items-end sm:gap-2">
            <span className="text-ink-soft">{row.items.length} {row.items.length === 1 ? "item" : "items"}</span>
            <span className="font-numeric font-semibold">{currency(computeSplit(row.people, row.items).grandTotal, row.currency)}</span>
          </div>
          <ChevronRight aria-hidden="true" className="col-start-2 row-start-1 h-5 w-5 text-ink-soft transition group-hover:translate-x-0.5 sm:col-start-3" />
        </Link>
      </li>)}</ul>}
  </Directory>;
}

export function FriendsDirectory() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const tabs = useQuery(api.tabs.list, isAuthenticated ? {} : "skip");
  const queries = useMemo(() => Object.fromEntries((tabs ?? []).map(tab => [tab.slug, { query: api.tabs.getBySlug, args: { slug: tab.slug } }])), [tabs]);
  const results = useQueries(queries);
  const people = new Map<string, { name: string; tabs: { slug: string; name: string }[] }>();
  let loading = isLoading || (isAuthenticated && tabs === undefined);
  let failed = false;
  for (const tab of tabs ?? []) {
    const detail = results[tab.slug] as FunctionReturnType<typeof api.tabs.getBySlug> | Error | undefined;
    if (detail === undefined) { loading = true; continue; }
    if (detail instanceof Error) { failed = true; continue; }
    for (const member of detail?.members ?? []) {
      const person = people.get(member.resolvedId) ?? { name: member.name, tabs: [] };
      person.tabs.push({ slug: tab.slug, name: tab.name });
      people.set(member.resolvedId, person);
    }
  }
  return <Directory title="Friends" description="The friends you share tabs with.">
    {loading ? <Notice>Loading friends…</Notice> : !isAuthenticated ? <Notice>Sign in to see your friends across tabs.</Notice> : failed ? <Notice>Some friends couldn’t be loaded. Please refresh to try again.</Notice> : !people.size ? <Notice>Friends will appear here when you create or join a tab.</Notice> :
      <ul className={directoryListClass}>
        {[...people].sort(([, a], [, b]) => a.name.localeCompare(b.name)).map(([id, person]) => (
          <li key={id} className="flex flex-wrap items-center gap-4 px-5 py-6 sm:flex-nowrap sm:px-6">
            <MemberAvatar id={id} name={person.name} />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg font-semibold break-words">{person.name}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {person.tabs.map(tab => (
                  <Link key={tab.slug} href={`/t/${tab.slug}`} className="inline-flex max-w-full items-center gap-2 rounded-md bg-paper px-3 py-1.5 text-sm text-forest transition hover:bg-rule/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
                    <span className="break-words min-w-0">{tab.name}</span>
                    <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
            <span className="ml-12 w-full text-sm text-ink-soft sm:ml-0 sm:w-auto sm:shrink-0">{person.tabs.length} shared {person.tabs.length === 1 ? "tab" : "tabs"}</span>
          </li>
        ))}
      </ul>}
  </Directory>;
}
