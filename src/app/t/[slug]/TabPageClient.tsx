"use client";

import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { api } from "../../../../convex/_generated/api";
import { MemberAvatar } from "@/components/MemberAvatar";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Authenticated, Unauthenticated, useConvexAuth, useQuery } from "convex/react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Search,
  X,
  Coins,
  HatGlasses,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  Unlink,
} from "lucide-react";
import { AssignExpenseDialog } from "@/components/AssignExpenseDialog";
import { TabBreakdown } from "@/components/TabBreakdown";
import { CurrencyFilter } from "@/components/ui/CurrencyFilter";
import { CurrencyPicker } from "@/components/ui/CurrencyPicker";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/Dialog";
import { BASE_PATH } from "@/lib/basePath";
import { computeSplit } from "@/lib/calculations";
import { currency, parseISODate } from "@/lib/format";
import {
  useTab,
  useTabActions,
  useTabBreakdown,
  useTabInviteLinks,
  useTabExpenses,
} from "@/lib/tabSync";
import { encodeDraftParams } from "@/lib/expenseDraft";
import { useExpenseActions } from "@/lib/expenseSync";
import { generateSlug } from "@/lib/slug";

const inputClass =
  "w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-margin-red/40";

export function TabPageClient() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const tab = useTab(slug);
  const breakdown = useTabBreakdown(slug);
  const expenses = useQuery(api.tabs.expensesForTab, { slug });

  if (tab === undefined || expenses === undefined) return <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 md:px-10 md:py-12"><p role="status" className="text-sm text-ink-soft">Loading tab…</p></main>;
  if (tab === null) {
    return (
      <main className="mx-auto w-full max-w-md px-6 py-16 text-center">
        <p className="text-ink-soft">This tab doesn&rsquo;t exist.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 md:px-10 md:py-12">
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-sm text-ink-soft">
        <Link href="/tabs" className="hover:text-forest hover:underline">Tabs</Link>
        <ChevronRight aria-hidden="true" className="h-4 w-4" />
        <span aria-current="page" className="font-medium text-ink">{tab.name}</span>
      </nav>
      {token && <ClaimBanner slug={slug} token={token} />}
      <header className="mb-7 flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <TabTitle slug={slug} name={tab.name} isOwner={tab.isOwner} />
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-soft">
            <span>{tab.members.length} {tab.members.length === 1 ? "member" : "members"}</span>
            {tab.isOwner ? <TabDefaultCurrency slug={slug} currency={tab.defaultCurrency} /> : <span>Tab currency · {tab.defaultCurrency}</span>}
          </div>
        </div>
        {tab.isOwner && <div className="flex flex-wrap items-center gap-3"><ExpenseActions slug={slug} members={tab.members} /><DeleteTabButton slug={slug} /></div>}
      </header>
      <div className="space-y-4">
        <Roster slug={slug} isOwner={tab.isOwner} members={tab.members} />
        <TabSummary expenses={expenses} defaultCurrency={tab.defaultCurrency} />
      </div>
      {breakdown && <div className="mt-7"><TabBreakdown tabSlug={slug} currencies={breakdown.currencies} members={tab.members} /></div>}
      <div className="mt-7"><ExpenseList defaultCurrency={tab.defaultCurrency} slug={slug} isOwner={tab.isOwner} members={tab.members} expenses={expenses} /></div>
    </main>
  );
}

function ClaimBanner({ slug, token }: { slug: string; token: string }) {
  const { isAuthenticated } = useConvexAuth();
  const { claimMember } = useTabActions();
  const hasClaimed = useRef(false);
  const [status, setStatus] = useState<"idle" | "claiming" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || hasClaimed.current) return;
    hasClaimed.current = true;
    setStatus("claiming");
    claimMember({ slug, token })
      .then(() => setStatus("done"))
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Couldn't claim this invite.");
      });
  }, [isAuthenticated, slug, token, claimMember]);

  if (status === "done") return null;

  return (
    <div className="mb-6 rounded-md border border-rule bg-surface p-4">
      <Unauthenticated>
        <p className="text-sm text-ink">
          You&rsquo;ve been invited to this tab. Sign in to claim your spot.
        </p>
      </Unauthenticated>
      <Authenticated>
        <p className="flex items-center gap-2 text-sm text-ink">
          {status === "claiming" && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />}
          {status === "error" ? (message ?? "Couldn't claim this invite.") : "Claiming your spot…"}
        </p>
      </Authenticated>
    </div>
  );
}

function TabTitle({ slug, name, isOwner }: { slug: string; name: string; isOwner: boolean }) {
  const { rename } = useTabActions();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || trimmed === name) {
      setEditing(false);
      return;
    }
    await rename({ slug, name: trimmed });
    setEditing(false);
  }

  if (editing) {
    return (
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleSubmit}
          className={`${inputClass} font-display max-w-sm text-2xl font-semibold`}
        />
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <h1 className="font-display text-3xl font-semibold text-ink break-words sm:text-4xl">{name}</h1>
        {isOwner && (
          <button
            type="button"
            onClick={() => {
              setValue(name);
              setEditing(true);
            }}
            aria-label="Rename tab"
            className="cursor-pointer rounded-md p-1.5 text-ink-soft transition hover:text-forest"
          >
            <Pencil className="h-4 w-4" strokeWidth={2.25} />
          </button>
        )}
      </div>

    </div>
  );
}

function TabDefaultCurrency({ slug, currency: currencyCode }: { slug: string; currency: string }) {
  const { setDefaultCurrency } = useTabActions();

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
      <Coins className="h-3.5 w-3.5 shrink-0 text-brass" strokeWidth={2.25} />
      <span>Tab currency</span>
      <CurrencyPicker
        value={currencyCode}
        onChange={(code) => setDefaultCurrency({ slug, currency: code })}
        aria-label="Tab currency"
      />
    </div>
  );
}

function DeleteTabButton({ slug }: { slug: string }) {
  const router = useRouter();
  const { deleteTab } = useTabActions();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteTab({ slug });
      router.push("/tabs");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete the tab.");
      setDeleting(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        {error && <span className="text-xs text-margin-red">{error}</span>}
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          aria-busy={deleting}
          className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-margin-red px-2.5 py-1.5 text-xs font-semibold text-margin-red transition hover:bg-margin-red hover:text-surface disabled:cursor-not-allowed disabled:opacity-70"
        >
          {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.5} />}
          Confirm delete
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={deleting}
          className="cursor-pointer text-xs font-medium text-ink-soft transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-70"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      aria-label="Delete tab"
      className="shrink-0 cursor-pointer rounded-md p-1.5 text-ink-soft transition hover:text-margin-red"
    >
      <Trash2 className="h-4 w-4" strokeWidth={2.25} />
    </button>
  );
}

function Roster({
  slug,
  isOwner,
  members,
}: {
  slug: string;
  isOwner: boolean;
  members: { id: string; name: string; claimed: boolean }[];
}) {
  const { addMember } = useTabActions();
  const inviteLinks = useTabInviteLinks(slug, isOwner);
  const [expanded, setExpanded] = useState(false);
  const membersId = useId();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    await addMember({ slug, name: trimmed });
    setNewName("");
    setAdding(false);
  }

  function copyInvite(memberId: string, token: string) {
    const url = `${window.location.origin}${BASE_PATH}/t/${slug}?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(memberId);
    setTimeout(() => setCopiedId((id) => (id === memberId ? null : id)), 2000);
  }

  return (
    <div className="rounded-xl border border-rule/70 bg-surface/80 p-5 sm:p-6">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={membersId}
        onClick={() => setExpanded(value => !value)}
        className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest"
      >
        <span className="flex items-center gap-3 font-display text-sm font-semibold text-ink">
          Members <span className="font-numeric font-normal text-ink-soft">{members.length}</span>
        </span>
        <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-ink-soft transition-transform duration-300 motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`} />
      </button>
      <div aria-hidden={expanded} inert={expanded} className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:transition-none ${expanded ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}>
        <div className="min-h-0 overflow-hidden">
          <div className="flex -space-x-2 pt-3">
            {members.slice(0, 5).map(member => (
              <MemberAvatar key={member.id} id={member.id} name={member.name} size="lg" />
            ))}
            {members.length > 5 && (
              <span aria-label={`${members.length - 5} more members`} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e9e8d9] text-sm font-semibold text-ink">
                +{members.length - 5}
              </span>
            )}
          </div>
        </div>
      </div>
      <div id={membersId} aria-hidden={!expanded} inert={!expanded} className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:transition-none ${expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="min-h-0 overflow-hidden">
      <ul className="mt-4 space-y-2 text-sm">
        {members.map((member) => {
          const invite = inviteLinks.find((l) => l.memberId === member.id);
          return (
            <li key={member.id} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-ink">
                <MemberAvatar id={member.id} name={member.name} />
                {member.name}
                {!member.claimed && (
                  <HatGlasses
                    className="h-3.5 w-3.5 shrink-0 text-ink-soft"
                    strokeWidth={2.25}
                    aria-label="Anonymous member"
                  />
                )}
              </span>
              {isOwner && !member.claimed && invite && (
                <button
                  type="button"
                  onClick={() => copyInvite(member.id, invite.token)}
                  className="inline-flex shrink-0 cursor-pointer items-center gap-1 text-xs font-medium text-forest hover:text-ink"
                >
                  {copiedId === member.id ? (
                    <>
                      <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                      Copied
                    </>
                  ) : (
                    <>
                      <Link2 className="h-3.5 w-3.5" strokeWidth={2.5} />
                      Copy invite
                    </>
                  )}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {isOwner &&
        (adding ? (
          <form onSubmit={handleAdd} className="mt-3 flex items-center gap-2 p-0.5">
            <input
              autoFocus
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={inputClass}
            />
            <button
              type="submit"
              className="shrink-0 cursor-pointer rounded-md bg-forest px-3 py-2 text-sm font-semibold text-surface transition hover:bg-ink"
            >
              Add
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-3 flex cursor-pointer items-center gap-1 text-xs font-medium text-forest hover:text-ink"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Add member
          </button>
        ))}
        </div>
      </div>
    </div>
  );
}

function ExpenseActions({ slug, members }: { slug: string; members: { resolvedId: string; id: string; name: string; claimed: boolean }[] }) {
  const router = useRouter();
  function handleNewExpense() {
    const params = encodeDraftParams(members.map(m => ({ id: m.resolvedId, name: m.name })), true);
    router.push(`/e/${generateSlug()}?${params.toString()}&tab=${slug}`);
  }
  return <>
    <AssignExpenseDialog tabSlug={slug} members={members} />
    <button type="button" onClick={handleNewExpense} className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-forest px-5 py-3 text-sm font-semibold text-surface transition hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"><Plus className="h-4 w-4" />Add expense</button>
  </>;
}

function TabSummary({ expenses, defaultCurrency }: { expenses: ReturnType<typeof useTabExpenses>; defaultCurrency: string }) {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    const total = totals.get(expense.settlementCurrency) ?? 0;
    totals.set(expense.settlementCurrency, total + Math.round(computeSplit(expense.people, expense.items).grandTotal * (expense.exchangeRate?.rate ?? 1) * 100) / 100);
  }
  if (!totals.size) totals.set(defaultCurrency, 0);
  const currencies = [...totals].sort(([a], [b]) => a.localeCompare(b));
  return (
    <section aria-label="Tab summary" className="rounded-xl border border-rule/70 bg-surface/80 p-5 sm:p-6">
      <h2 className="text-sm font-medium text-ink-soft">Total spent</h2>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-y-4">
        {currencies.map(([code, total], index) => (
          <p key={code} className={`flex min-w-0 items-center gap-2 font-numeric text-2xl font-semibold sm:flex-1 ${index > 0 ? "border-t border-rule/70 pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6" : ""}`}>
            <span className="rounded-md border border-rule px-1.5 py-0.5 text-xs font-medium text-ink-soft">{code}</span>
            <span className="break-all">{currency(total, code)}</span>
          </p>
        ))}
      </div>
    </section>
  );
}

// One grid template shared by the expense list's header and its rows so the
// columns line up. Every track but the first is a fixed width: each row is its
// own grid, so an `auto` track would size to that row's own content and the
// columns would drift out of alignment with each other. Below `md` the middle
// columns collapse into a metadata line underneath the name, leaving
// expense / amount.
const expenseRowGrid =
  "grid grid-cols-[minmax(0,1fr)_6.5rem] items-center gap-x-4 gap-y-3 px-5 md:grid-cols-[minmax(0,1fr)_7rem_9rem_7.5rem_6.5rem]";

function formatExpenseDate(iso: string | undefined) {
  const date = iso ? parseISODate(iso) : undefined;
  return date?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function AvatarStack({ people }: { people: { id: string; name: string }[] }) {
  const shown = people.slice(0, 3);
  const overflow = people.length - shown.length;
  return <span className="flex items-center">
    <span className="flex gap-1">{shown.map(person => <MemberAvatar key={person.id} id={person.id} name={person.name} size="sm" />)}</span>
    {overflow > 0 && <span className="ml-2 text-xs text-ink-soft">+{overflow}</span>}
  </span>;
}

function ExpenseMetadata({ expense }: { expense: ReturnType<typeof useTabExpenses>[number] }) {
  const date = expense.date ? parseISODate(expense.date) : undefined;
  return <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-soft">
    <span><span className="mr-1 font-medium">Date</span>{date ? <time dateTime={expense.date}>{date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</time> : "Not set"}</span>
    <span className="inline-flex items-center gap-2"><span className="font-medium">Created by</span>{expense.createdBy && <MemberAvatar id={expense.createdBy.id} name={expense.createdBy.name} />}<span>{expense.createdBy?.name ?? "Unknown creator"}</span></span>
  </span>;
}

function ExpenseList({ slug, defaultCurrency, isOwner, expenses }: {
  defaultCurrency: string;
  slug: string;
  isOwner: boolean;
  members: { id: string; name: string; claimed: boolean; resolvedId: string }[];
  expenses: ReturnType<typeof useTabExpenses>;
}) {
  const { unassignExpense } = useTabActions();
  const { remove } = useExpenseActions();
  const [search, setSearch] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const codes = [...new Set(expenses.map(e => e.settlementCurrency))].sort();
  const filtered = expenses.filter(e => (currencyFilter === "all" || e.settlementCurrency === currencyFilter) && (e.name ?? "Untitled expense").toLowerCase().includes(search.trim().toLowerCase()));
  const selected = filtered.find(e => e.slug === selectedSlug);
  const split = selected ? computeSplit(selected.people, selected.items) : null;
  async function act(action: "remove" | "delete") {
    if (!selected) return;
    setPending(true); setError(null);
    try {
      if (action === "delete") await remove(selected.slug);
      else await unassignExpense({ expenseSlug: selected.slug });
      setSelectedSlug(null); setConfirmDelete(false);
    } catch (err) { setError(err instanceof Error ? err.message : "Couldn't update the expense."); }
    finally { setPending(false); }
  }
  return <section aria-label="Expenses" className="rounded-xl border border-rule/70 bg-surface/80 p-5 sm:p-6">
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <h2 className="mr-auto font-display text-lg font-semibold">Expenses <span className="ml-2 text-sm font-normal text-ink-soft">{filtered.length}</span></h2>
      <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-rule bg-paper px-3 focus-within:ring-2 focus-within:ring-forest/20 sm:max-w-sm"><Search className="h-4 w-4 text-ink-soft" /><input aria-label="Search tab expenses" placeholder="Search expenses…" value={search} onChange={e => setSearch(e.target.value)} className="w-full min-w-0 bg-transparent text-xs outline-none" /></label>
      <CurrencyFilter value={currencyFilter} onChange={setCurrencyFilter} codes={codes} label="Filter by currency" />
    </div>
    <div className="overflow-hidden rounded-lg border border-rule/70">
      <div className={`${expenseRowGrid} border-b border-rule/70 py-3 text-xs font-medium uppercase text-ink-soft`}>
        <span>Expense</span>
        <span className="hidden md:block">Date</span>
        <span className="hidden text-center md:block">Created by</span>
        <span className="hidden text-center md:block">Split with</span>
        <span className="text-right">Amount</span>
      </div>
      {!filtered.length ? <p role="status" className="p-8 text-center text-sm text-ink-soft">{expenses.length ? "No expenses match your filters." : "No expenses yet. Add one to get started."}</p> : <ul className="divide-y divide-rule/70">{filtered.map(expense => <li key={expense.slug}>
        <button type="button" aria-haspopup="dialog" onClick={() => { setSelectedSlug(expense.slug); setConfirmDelete(false); setError(null); }} className={`${expenseRowGrid} w-full cursor-pointer py-4 text-left transition-colors hover:bg-[#f3ead8] focus-visible:bg-[#f3ead8] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest`}>
          <span className="flex min-w-0 items-center gap-3">
            <span aria-hidden="true" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f3ead8] text-brass"><Receipt className="h-5 w-5" strokeWidth={2.25} /></span>
            <span className="min-w-0">
              <span className="block font-semibold break-words">{expense.name ?? "Untitled expense"}</span>
              <span className="block text-xs text-ink-soft">{expense.items.length} {expense.items.length === 1 ? "item" : "items"}</span>
            </span>
          </span>
          <span className="hidden text-sm text-ink-soft md:block">{expense.date ? <time dateTime={expense.date}>{formatExpenseDate(expense.date)}</time> : "Not set"}</span>
          <span className="hidden min-w-0 items-center justify-center gap-2 text-sm md:flex">
            {expense.createdBy && <MemberAvatar id={expense.createdBy.id} name={expense.createdBy.name} size="sm" />}
            <span className="truncate">{expense.createdBy?.name ?? "Unknown creator"}</span>
          </span>
          <span className="hidden justify-center md:flex"><AvatarStack people={expense.people} /></span>
          <span className="text-right"><span className="block font-numeric text-sm font-semibold">{currency(computeSplit(expense.people, expense.items).grandTotal * (expense.exchangeRate?.rate ?? 1), expense.settlementCurrency)}</span><span className="block text-xs text-ink-soft">{expense.exchangeRate ? `${currency(computeSplit(expense.people, expense.items).grandTotal, expense.currency)} · converted` : expense.currency}</span></span>
          <span className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-ink-soft md:hidden">
            {expense.date && <time dateTime={expense.date}>{formatExpenseDate(expense.date)}</time>}
            <span className="inline-flex items-center gap-1.5">{expense.createdBy && <MemberAvatar id={expense.createdBy.id} name={expense.createdBy.name} size="sm" />}{expense.createdBy?.name ?? "Unknown creator"}</span>
            <AvatarStack people={expense.people} />
          </span>
        </button>
      </li>)}</ul>}
    </div>
    <Dialog open={Boolean(selected)} onOpenChange={next => { if (!next) { setSelectedSlug(null); setConfirmDelete(false); setError(null); } }}>
      {selected && split && <DialogContent aria-label="Expense details">
        <div className="flex items-start justify-between gap-3"><DialogTitle>{selected.name ?? "Untitled expense"}</DialogTitle><DialogClose aria-label="Close expense details" className="cursor-pointer rounded-md p-1 text-ink-soft hover:bg-[#f3ead8]"><X className="h-5 w-5" /></DialogClose></div>
        <p className="mt-5 font-numeric text-2xl font-semibold">{currency(split.grandTotal, selected.currency)}</p><p className="mt-1 text-sm text-ink-soft">{selected.currency} · {selected.items.length} {selected.items.length === 1 ? "item" : "items"}</p>
        <ExpenseMetadata expense={selected} />
        {selected.currency !== defaultCurrency && <ExchangeRateForm key={`${selected.slug}:${selected.currency}:${defaultCurrency}:${selected.exchangeRate?.rate ?? "none"}`} tabSlug={slug} expense={selected} target={defaultCurrency} canEdit={isOwner} />}
        {isOwner && <div className="mt-5 flex flex-wrap gap-2">
          <Link href={`/e/${selected.slug}`} className="inline-flex items-center gap-2 rounded-lg border border-rule px-3 py-2 text-sm hover:bg-[#f3ead8]"><Pencil className="h-4 w-4" />Edit</Link>
          <button type="button" disabled={pending} onClick={() => void act("remove")} className="inline-flex items-center gap-2 rounded-lg border border-rule px-3 py-2 text-sm hover:bg-[#f3ead8] disabled:opacity-50"><Unlink className="h-4 w-4" />Remove from tab</button>
          <button type="button" disabled={pending} onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-2 rounded-lg border border-rule px-3 py-2 text-sm text-margin-red hover:bg-[#f3ead8] disabled:opacity-50"><Trash2 className="h-4 w-4" />Delete</button>
        </div>}
        {confirmDelete && <div className="mt-3 text-sm"><p>Delete this expense permanently?</p><div className="mt-2 flex gap-3"><button disabled={pending} onClick={() => void act("delete")} className="font-semibold text-margin-red">Confirm delete</button><button disabled={pending} onClick={() => setConfirmDelete(false)}>Cancel</button></div></div>}
        {error && <p role="alert" className="mt-3 text-sm text-margin-red">{error}</p>}
        <h4 className="mt-6 border-t border-rule/70 pt-5 text-sm font-semibold">Split with</h4><ul className="mt-3 space-y-3">{split.people.map(person => <li key={person.personId} className="flex items-center gap-2 text-sm"><MemberAvatar id={person.personId} name={person.name} /><span className="min-w-0 flex-1 break-words">{person.name}</span><span className="font-numeric">{currency(person.total, selected.currency)}</span></li>)}</ul>
        <h4 className="mt-6 border-t border-rule/70 pt-5 text-sm font-semibold">Items</h4><ul className="mt-3 space-y-3">{split.items.map(item => <li key={item.itemId} className="flex justify-between gap-3 text-sm"><span className="min-w-0 break-words">{item.itemName}</span><span className="font-numeric shrink-0">{currency(item.total, selected.currency)}</span></li>)}</ul>
      </DialogContent>}
    </Dialog>
  </section>;
}

function ExchangeRateForm({ tabSlug, expense, target, canEdit }: { tabSlug: string; expense: ReturnType<typeof useTabExpenses>[number]; target: string; canEdit: boolean }) {
  const { setExpenseExchangeRate } = useTabActions();
  const [value, setValue] = useState(expense.exchangeRate?.rate.toString() ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rate = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(rate) && rate > 0;
  async function save(next: number | null) {
    setPending(true); setError(null);
    try { await setExpenseExchangeRate({ slug: tabSlug, expenseSlug: expense.slug, from: expense.currency, to: target, rate: next }); }
    catch (err) { setError(err instanceof Error ? err.message : "Couldn't save the exchange rate."); }
    finally { setPending(false); }
  }
  return <form onSubmit={event => { event.preventDefault(); if (valid) void save(rate); }} className="mt-5 rounded-lg border border-rule bg-paper p-4">
    <h4 className="text-sm font-semibold">Exchange to {target}</h4>
    <p className="mt-1 text-xs text-ink-soft">Optional. Apply a rate to include this expense and its payments in the tab’s {target} balance.</p>
    {canEdit ? <>
      <label htmlFor="expense-exchange-rate" className="mt-3 flex items-center gap-2 text-sm">
        <span className="shrink-0">1 {expense.currency} =</span>
        <input id="expense-exchange-rate" type="number" inputMode="decimal" step="any" min="0" required value={value} disabled={pending} onChange={event => setValue(event.target.value)} placeholder="e.g. 1.38" aria-describedby="exchange-preview" className="w-full min-w-0 rounded-md border border-rule bg-surface px-3 py-2 font-numeric outline-none focus:ring-2 focus:ring-forest/30" />
        <span>{target}</span>
      </label>
      <p id="exchange-preview" aria-live="polite" className="mt-2 text-xs text-ink-soft">{valid ? `Converted total: ${currency(computeSplit(expense.people, expense.items).grandTotal * rate, target)}` : "Enter a rate greater than zero."}</p>
      <div className="mt-3 flex gap-3"><button disabled={!valid || pending} className="rounded-md bg-forest px-3 py-2 text-xs font-medium text-white disabled:opacity-50">{pending ? "Saving…" : "Save rate"}</button>{expense.exchangeRate && <button type="button" disabled={pending} onClick={() => void save(null)} className="text-xs text-ink-soft hover:text-margin-red">Remove rate</button>}</div>
    </> : <p className="mt-3 text-sm">{expense.exchangeRate ? `1 ${expense.currency} = ${expense.exchangeRate.rate} ${target}` : "No exchange rate applied."}</p>}
    {expense.exchangeRate && <p role="status" className="mt-3 text-xs text-forest">Saved rate: 1 {expense.currency} = {expense.exchangeRate.rate} {target}. Included in {target} balances.</p>}
    {error && <p role="alert" className="mt-2 text-xs text-margin-red">{error}</p>}
  </form>;
}
