import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import type { FunctionReturnType } from "convex/server";
import { ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { MemberAvatar } from "@/components/MemberAvatar";
import { CreateTabMenu } from "@/components/CreateTabMenu";
import { NewExpenseButton } from "@/components/NewExpenseButton";
import { UpcomingExpenseIcon, UpcomingExpenseLegend } from "@/components/UpcomingExpenseIcon";
import { useExpenseList } from "@/lib/expenseSync";
import { computeSplit } from "@/lib/calculations";
import { currency, formatExpenseDate, isUpcoming } from "@/lib/format";
import { PageDescription, PageTitle, SectionTitle } from "@/components/ui/Typography";
import { EmptyState, Page } from "@/components/ui/Page";
import { Button } from "@/components/ui/Button";
import { AnonymousBadge } from "@/components/ui/AnonymousBadge";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/Dialog";

function Directory({ title, description, action, children }: { title: string; description: string; action?: ReactNode; children: ReactNode }) {
  return <Page>
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div><PageTitle>{title}</PageTitle><PageDescription>{description}</PageDescription></div>
      {action}
    </header>
    {children}
  </Page>;
}

function Notice({ children }: { children: ReactNode }) {
  return <EmptyState>{children}</EmptyState>;
}

const directoryListClass = "divide-y divide-rule/70 overflow-hidden rounded-xl border border-rule/70 bg-surface/80";
// The whole row is one link, carrying no actions of its own - so it needs no
// overlay and no actions track. If a row ever does gain actions, see
// DESIGN.md § 5, "Interactive rows": a button cannot nest inside this link.
const directoryRowClass = "group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-4 px-5 py-6 transition-colors hover:bg-wash focus-visible:bg-wash focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest sm:grid-cols-[minmax(0,1fr)_minmax(0,auto)_auto] sm:px-6";

type TabRow = FunctionReturnType<typeof api.tabs.listWithSummary>[number];

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
function TabDirectoryRow({ tab }: { tab: TabRow }) {
  return <li>
    <Link to="/t/$slug" params={{ slug: tab.slug }} className={directoryRowClass}>
      <div className="min-w-0">
        <SectionTitle>{tab.name}</SectionTitle>
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
      <ChevronRight aria-hidden="true" className="col-start-2 row-start-1 h-5 w-5 text-ink-soft chevron-x sm:col-start-3" />
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
    total: computeSplit(state.people, state.items, state.globalAdjustments).grandTotal,
    date: state.date,
    updatedAt: state.updatedAt ?? 0,
  })), [localExpenses]);
  const loading = isLoading || (isAuthenticated && remoteRows === undefined);
  const rows = isAuthenticated ? remoteRows ?? [] : localRows;
  const filtered = rows.filter(row => `${row.name} ${row.tabName}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <Directory title="Expenses" description={isAuthenticated ? "All your expenses across all tabs, together in one place." : "Guest expenses saved in this browser. These stay separate from your account."} action={<NewExpenseButton variant="primary" />}>
    <label className="mb-5 flex items-center gap-3 rounded-lg border border-edge bg-field px-4 py-3 focus-within:border-forest focus-within:ring-2 focus-within:ring-forest/20">
      <Search className="h-4 w-4 text-ink-soft" /><input aria-label="Search expenses or tabs" placeholder="Search expenses or tabs…" value={search} onChange={event => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent text-base outline-none sm:text-sm" />
    </label>
    {loading ? <Notice>Loading expenses…</Notice> : !filtered.length ? <Notice>{rows.length ? "No expenses match your search." : "No expenses yet. Split an expense to get started."}</Notice> :
      <><ul className={directoryListClass}>{filtered.map(row => <li key={row.key}>
        <Link {...(row.kind === "own"
          ? ({ to: "/e/$slug", params: { slug: row.slug } } as const)
          : ({ to: "/t/$slug", params: { slug: row.tabSlug! } } as const))} className={directoryRowClass}>
          <div className="min-w-0">
            <SectionTitle>{row.name}</SectionTitle>
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
          <ChevronRight aria-hidden="true" className="col-start-2 row-start-1 h-5 w-5 text-ink-soft chevron-x sm:col-start-3" />
        </Link>
      </li>)}</ul>{filtered.some(row => isUpcoming(row.date)) && <UpcomingExpenseLegend />}</>}
  </Directory>;
}


/**
 * One friend. The shared tabs used to sit inline as chips, which disappeared
 * against the card and wrapped badly once someone shared more than two or
 * three. They live behind a dialog now: the row states the count, the dialog
 * lists them — the same shape as the tab page's member roster.
 */
function FriendRow({ id, name, claimed, tabs }: { id: string; name: string; claimed: boolean; tabs: { slug: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const count = `${tabs.length} shared ${tabs.length === 1 ? "tab" : "tabs"}`;
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-5 sm:flex-nowrap sm:px-6">
      <MemberAvatar id={id} name={name} className={claimed ? "" : "opacity-60"} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <SectionTitle>{name}</SectionTitle>
          {!claimed && <AnonymousBadge />}
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={<Button type="button" variant="outline" size="touch" aria-label={`View the ${count} with ${name}`} className="group w-full justify-between sm:w-auto sm:justify-center" />}
        >
          {count}
          <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 chevron-y" />
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle>{name}</DialogTitle>
              <DialogDescription className="mt-1">Tabs you both belong to</DialogDescription>
            </div>
            <DialogClose aria-label="Close" render={<Button variant="ghost" size="icon-touch" className="text-ink-soft" />}>
              <X className="h-4 w-4" />
            </DialogClose>
          </div>
          <ul className="mt-4 overflow-hidden rounded-lg border border-edge bg-field">
            {tabs.map(tab => (
              <li key={tab.slug} className="border-b border-rule/70 last:border-b-0">
                <Link
                  to="/t/$slug"
                  params={{ slug: tab.slug }}
                  onClick={() => setOpen(false)}
                  className="group flex min-h-11 items-center justify-between gap-3 px-4 py-3 text-sm text-ink transition hover:bg-wash focus-visible:bg-wash focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest"
                >
                  <span className="min-w-0 break-words font-medium">{tab.name}</span>
                  <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-soft chevron-x" />
                </Link>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </li>
  );
}

export function FriendsDirectory() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { data: people } = useQuery(convexQuery(api.tabs.friends, isAuthenticated ? {} : "skip"));
  const loading = isLoading || (isAuthenticated && people === undefined);
  return <Directory title="Friends" description="The people you share tabs with. Anonymous friends haven’t claimed an invite yet.">
    {loading ? <Notice>Loading friends…</Notice> : !isAuthenticated ? <Notice>Sign in to see your friends across tabs.</Notice> : !people?.length ? <Notice>Friends will appear here when you create or join a tab.</Notice> :
      <ul className={directoryListClass}>
        {people.map(({ id, ...person }) => <FriendRow key={id} id={id} name={person.name} claimed={person.claimed} tabs={person.tabs} />)}
      </ul>}
  </Directory>;
}
