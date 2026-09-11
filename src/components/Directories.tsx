import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import type { FunctionReturnType } from "convex/server";
import { ChevronRight, HatGlasses, Search } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { MemberAvatar } from "@/components/MemberAvatar";
import { CreateTabMenu } from "@/components/CreateTabMenu";
import { NewExpenseButton } from "@/components/NewExpenseButton";
import { UpcomingExpenseIcon, UpcomingExpenseLegend } from "@/components/UpcomingExpenseIcon";
import { useExpenseList } from "@/lib/expenseSync";
import { computeSplit } from "@/lib/calculations";
import { currency, formatExpenseDate, isUpcoming } from "@/lib/format";

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
  const { data: tabs } = useQuery(convexQuery(api.tabs.listWithSummary, isAuthenticated ? {} : "skip"));
  return <Directory title="Tabs" description="Your tabs, all in one place." action={<CreateTabMenu variant="primary" />}>
    {isLoading || (isAuthenticated && tabs === undefined) ? <Notice>Loading tabs…</Notice> : !isAuthenticated ? <Notice>Sign in to create a tab or see the tabs you belong to.</Notice> : !tabs?.length ? <Notice>No tabs yet. Create a tab to start splitting expenses together.</Notice> :
      <ul className={directoryListClass}>
        {tabs.map(tab => <TabDirectoryRow key={tab.slug} tab={tab} />)}
      </ul>}
  </Directory>;
}

// Purely presentational - every field arrives with the tab from
// `listWithSummary`, so a row never loads anything of its own.
function TabDirectoryRow({ tab }: { tab: FunctionReturnType<typeof api.tabs.listWithSummary>[number] }) {
  return <li>
    <Link to="/t/$slug" params={{ slug: tab.slug }} className={directoryRowClass}>
      <div className="min-w-0">
        <h2 className="font-display text-lg font-semibold break-words">{tab.name}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label={`${tab.memberCount} ${tab.memberCount === 1 ? "member" : "members"}`}>
          {tab.members.map(member => <MemberAvatar key={member.id} id={member.id} name={member.name} />)}
          <span className="ml-2 text-xs text-ink-soft">{tab.memberCount} {tab.memberCount === 1 ? "member" : "members"}</span>
        </div>
      </div>
      <div className="col-start-1 row-start-2 flex flex-wrap items-center justify-between gap-3 text-sm sm:col-start-2 sm:row-start-1 sm:flex-col sm:items-end sm:gap-2">
        <span className="text-ink-soft">{tab.expenseCount} {tab.expenseCount === 1 ? "expense" : "expenses"}</span>
        <span className="flex flex-wrap gap-x-3 gap-y-1 font-numeric font-semibold sm:flex-col sm:items-end">
          {tab.totals.map(({ currency: code, total }) => <span key={code}>{currency(total, code)}</span>)}
          {!tab.expenseCount && <span>{currency(0, tab.defaultCurrency)}</span>}
        </span>
      </div>
      <ChevronRight aria-hidden="true" className="col-start-2 row-start-1 h-5 w-5 text-ink-soft transition group-hover:translate-x-0.5 sm:col-start-3" />
    </Link>
  </li>;
}

export function ExpensesDirectory() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { data: remoteRows } = useQuery(convexQuery(api.expenses.directory, isAuthenticated ? {} : "skip"));
  const localExpenses = useExpenseList();
  const [search, setSearch] = useState("");
  // Signed out, the only expenses that exist are the ones in local storage -
  // shaped here to match what the server returns for a signed-in user.
  const localRows = useMemo(() => localExpenses.map(({ slug, state }) => ({
    key: `own-${slug}`,
    kind: "own" as const,
    slug,
    tabSlug: undefined,
    name: state.name,
    tabName: "Personal expense",
    people: state.people,
    itemCount: state.items.length,
    currency: state.currency,
    total: computeSplit(state.people, state.items).grandTotal,
    date: state.date,
    updatedAt: state.updatedAt ?? 0,
  })), [localExpenses]);
  const loading = isLoading || (isAuthenticated && remoteRows === undefined);
  const rows = isAuthenticated ? remoteRows ?? [] : localRows;
  const filtered = rows.filter(row => `${row.name} ${row.tabName}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <Directory title="Expenses" description={isAuthenticated ? "All your expenses across all tabs, together in one place." : "Guest expenses saved in this browser. These stay separate from your account."} action={<NewExpenseButton variant="primary" />}>
    <label className="mb-5 flex items-center gap-3 rounded-lg border border-rule bg-surface px-4 py-3 focus-within:border-forest focus-within:ring-2 focus-within:ring-forest/20">
      <Search className="h-4 w-4 text-ink-soft" /><input aria-label="Search expenses or tabs" placeholder="Search expenses or tabs…" value={search} onChange={event => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
    </label>
    {loading ? <Notice>Loading expenses…</Notice> : !filtered.length ? <Notice>{rows.length ? "No expenses match your search." : "No expenses yet. Split an expense to get started."}</Notice> :
      <><ul className={directoryListClass}>{filtered.map(row => <li key={row.key}>
        <Link {...(row.kind === "own"
          ? ({ to: "/e/$slug", params: { slug: row.slug } } as const)
          : ({ to: "/t/$slug", params: { slug: row.tabSlug! } } as const))} className={directoryRowClass}>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold break-words">{row.name}</h2>
            <p className="mt-1 text-sm text-ink-soft break-words">{row.tabName}</p>
            {/* This list has no date column, so the date rides along under the
                tab name. The icon only joins it when the expense is still
                ahead - on its own it would say "later" without saying when. */}
            {formatExpenseDate(row.date) && <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft">
              <UpcomingExpenseIcon date={row.date} />
              <time dateTime={row.date}>{formatExpenseDate(row.date)}</time>
            </p>}
            <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label={`${row.people.length} participants`}>
              {row.people.map(person => <MemberAvatar key={person.id} id={person.id} name={person.name} />)}
              <span className="ml-2 text-xs text-ink-soft">{row.people.length} {row.people.length === 1 ? "person" : "people"}</span>
            </div>
          </div>
          <div className="col-start-1 row-start-2 flex flex-wrap items-center justify-between gap-3 text-sm sm:col-start-2 sm:row-start-1 sm:flex-col sm:items-end sm:gap-2">
            <span className="text-ink-soft">{row.itemCount} {row.itemCount === 1 ? "item" : "items"}</span>
            <span className="font-numeric font-semibold">{currency(row.total, row.currency)}</span>
          </div>
          <ChevronRight aria-hidden="true" className="col-start-2 row-start-1 h-5 w-5 text-ink-soft transition group-hover:translate-x-0.5 sm:col-start-3" />
        </Link>
      </li>)}</ul>{filtered.some(row => isUpcoming(row.date)) && <UpcomingExpenseLegend />}</>}
  </Directory>;
}

export function FriendsDirectory() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { data: people } = useQuery(convexQuery(api.tabs.friends, isAuthenticated ? {} : "skip"));
  const loading = isLoading || (isAuthenticated && people === undefined);
  return <Directory title="Friends" description="The people you share tabs with. Anonymous friends haven’t claimed an invite yet.">
    {loading ? <Notice>Loading friends…</Notice> : !isAuthenticated ? <Notice>Sign in to see your friends across tabs.</Notice> : !people?.length ? <Notice>Friends will appear here when you create or join a tab.</Notice> :
      <ul className={directoryListClass}>
        {people.map(({ id, ...person }) => (
          <li key={id} className="flex flex-wrap items-center gap-4 px-5 py-6 sm:flex-nowrap sm:px-6">
            <MemberAvatar id={id} name={person.name} className={person.claimed ? "" : "opacity-60"} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg font-semibold break-words">{person.name}</h2>
                {!person.claimed && <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-rule px-2 py-0.5 text-xs font-medium text-ink-soft">
                  <HatGlasses aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.25} />Anonymous
                </span>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {person.tabs.map(tab => (
                  <Link key={tab.slug} to="/t/$slug" params={{ slug: tab.slug }} className="inline-flex max-w-full items-center gap-2 rounded-md bg-paper px-3 py-1.5 text-sm text-forest transition hover:bg-rule/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
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
