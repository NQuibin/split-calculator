import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { api } from "../../convex/_generated/api";
import { MemberAvatar } from "@/components/MemberAvatar";
import { Authenticated, Unauthenticated, useConvexAuth, useQuery } from "convex/react";
import {
  ArrowUpRight,
  FileText,
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
} from "lucide-react";
import { TabBreakdown } from "@/components/TabBreakdown";
import { CurrencyFilter } from "@/components/ui/CurrencyFilter";
import { CurrencyPicker } from "@/components/ui/CurrencyPicker";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/Dialog";
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

const route = getRouteApi("/t/$slug/");

export function TabPage() {
  const { slug } = route.useParams();
  const { token } = route.useSearch();

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
        <Link to="/tabs" className="hover:text-forest hover:underline">Tabs</Link>
        <ChevronRight aria-hidden="true" className="h-4 w-4" />
        <span aria-current="page" className="font-medium text-ink">{tab.name}</span>
      </nav>
      {token && <ClaimBanner slug={slug} token={token} />}
      <header className="mb-7 flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <TabTitle slug={slug} name={tab.name} isOwner={tab.isOwner} />
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-soft">
            <Roster slug={slug} isOwner={tab.isOwner} members={tab.members} />
            {tab.isOwner ? <TabDefaultCurrency slug={slug} currency={tab.defaultCurrency} /> : <span className="inline-flex items-center gap-2"><Coins aria-hidden="true" className="h-3.5 w-3.5 text-brass" strokeWidth={2.25} />Tab currency · {tab.defaultCurrency}</span>}
          </div>
        </div>
        {tab.isOwner && <div className="flex flex-wrap items-center gap-3"><ExpenseActions slug={slug} members={tab.members} /><DeleteTabButton slug={slug} /></div>}
      </header>
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
            className="rounded-md p-1.5 text-ink-soft transition hover:text-forest"
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
  const navigate = useNavigate();
  const { deleteTab } = useTabActions();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteTab({ slug });
      void navigate({ to: "/tabs" });
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
          className="inline-flex items-center gap-1 rounded-md border border-margin-red px-2.5 py-1.5 text-xs font-semibold text-margin-red transition hover:bg-margin-red hover:text-surface disabled:cursor-not-allowed disabled:opacity-70"
        >
          {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.5} />}
          Confirm delete
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={deleting}
          className="text-xs font-medium text-ink-soft transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-70"
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
      className="shrink-0 rounded-md p-1.5 text-ink-soft transition hover:text-margin-red"
    >
      <Trash2 className="h-4 w-4" strokeWidth={2.25} />
    </button>
  );
}

function Roster({ slug, isOwner, members }: {
  slug: string;
  isOwner: boolean;
  members: { id: string; name: string; claimed: boolean }[];
}) {
  const { addMember, renameMember, removeMember } = useTabActions();
  const inviteLinks = useTabInviteLinks(slug, isOwner);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function resetForm() {
    setEditingId(null); setAdding(false); setName(""); setRemovingId(null); setError(null);
  }

  async function saveMember(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || pending) return;
    setPending(true); setError(null);
    try {
      if (editingId) await renameMember({ slug, memberId: editingId, name: name.trim() });
      else await addMember({ slug, name: name.trim() });
      resetForm();
    } catch (err) { setError(err instanceof Error ? err.message : "Couldn't save the member."); }
    finally { setPending(false); }
  }

  async function handleRemove(memberId: string) {
    setPending(true); setError(null);
    try { await removeMember({ slug, memberId }); resetForm(); }
    catch (err) { setError(err instanceof Error ? err.message : "Couldn't remove the member."); }
    finally { setPending(false); }
  }

  async function copyInvite(memberId: string, token: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${BASE_PATH}/t/${slug}?token=${token}`);
      setCopiedId(memberId);
      setTimeout(() => setCopiedId(id => id === memberId ? null : id), 2000);
    } catch { setError("Couldn't copy the invite. Please try again."); }
  }

  const memberForm = <form onSubmit={saveMember} className="mt-3 flex flex-wrap items-center gap-2">
    <input autoFocus aria-label="Member name" placeholder="Name" value={name} disabled={pending} onChange={event => setName(event.target.value)} className={`${inputClass} min-w-0 flex-1 basis-40`} />
    <button type="submit" disabled={pending || !name.trim()} className="rounded-md bg-forest px-3 py-2 text-sm font-semibold text-surface hover:bg-ink disabled:opacity-50">{pending ? "Saving…" : adding ? "Add" : "Save"}</button>
    <button type="button" disabled={pending} onClick={resetForm} className="px-2 py-2 text-sm text-ink-soft hover:text-ink">Cancel</button>
  </form>;

  return <Dialog open={open} onOpenChange={next => { if (!pending) { setOpen(next); resetForm(); } }}>
    <DialogTrigger aria-label={`View ${members.length} ${members.length === 1 ? "member" : "members"}`} className="inline-flex min-h-11 items-center gap-2.5 rounded-lg px-1 text-sm text-ink-soft transition hover:bg-surface hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
      {members.length > 0 && <span aria-hidden="true" className="flex -space-x-2">
        {members.slice(0, 5).map(member => <MemberAvatar key={member.id} id={member.id} name={member.name} className="ring-2 ring-paper" />)}
        {members.length > 5 && <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface text-xs font-semibold ring-2 ring-paper">+{members.length - 5}</span>}
      </span>}
      <span>{members.length} {members.length === 1 ? "member" : "members"}</span>
      <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" />
    </DialogTrigger>
    <DialogContent>
      <div className="flex items-start justify-between gap-3">
        <div><DialogTitle>Members</DialogTitle><DialogDescription className="mt-1">{members.length} {members.length === 1 ? "person" : "people"} in this tab</DialogDescription></div>
        <DialogClose disabled={pending} aria-label="Close members" className="rounded-md p-1 text-ink-soft hover:bg-paper"><X className="h-5 w-5" /></DialogClose>
      </div>
      <ul className="mt-5 space-y-3">
        {members.map(member => {
          const invite = inviteLinks.find(link => link.memberId === member.id);
          return <li key={member.id} className="rounded-lg border border-rule/70 p-3">
            <div className="flex items-center gap-3">
              <MemberAvatar id={member.id} name={member.name} size="lg" />
              <span className="min-w-0 flex-1 break-words text-sm font-medium">{member.name}</span>
              {!member.claimed && <HatGlasses className="h-3.5 w-3.5 shrink-0 text-ink-soft" aria-label="Anonymous member" />}
              {isOwner && <div className="flex shrink-0 items-center">
                <button type="button" disabled={pending} aria-label={`Edit ${member.name}`} onClick={() => { resetForm(); setEditingId(member.id); setName(member.name); }} className="rounded-md p-2 text-ink-soft hover:bg-paper hover:text-forest disabled:opacity-50"><Pencil className="h-4 w-4" /></button>
                <button type="button" disabled={pending} aria-label={`Remove ${member.name}`} onClick={() => { resetForm(); setRemovingId(member.id); }} className="rounded-md p-2 text-ink-soft hover:bg-paper hover:text-margin-red disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>
              </div>}
            </div>
            {isOwner && !member.claimed && invite && <button type="button" onClick={() => void copyInvite(member.id, invite.token)} className="mt-2 inline-flex items-center gap-1.5 rounded-md py-1 text-xs font-medium text-forest hover:text-ink">{copiedId === member.id ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}{copiedId === member.id ? "Copied" : "Copy invite"}</button>}
            {isOwner && editingId === member.id && memberForm}
            {isOwner && removingId === member.id && <div className="mt-3 text-sm"><p>Remove {member.name} from this tab?</p><div className="mt-2 flex gap-3"><button type="button" disabled={pending} onClick={() => void handleRemove(member.id)} className="rounded-md py-1 font-semibold text-margin-red disabled:opacity-50">{pending ? "Removing…" : "Remove member"}</button><button type="button" disabled={pending} onClick={resetForm} className="rounded-md py-1 text-ink-soft">Cancel</button></div></div>}
          </li>;
        })}
      </ul>
      {!members.length && <p className="mt-4 text-sm text-ink-soft">No members yet.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-margin-red">{error}</p>}
      {isOwner && (adding ? memberForm : <button type="button" disabled={pending} onClick={() => { resetForm(); setAdding(true); }} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-forest px-4 py-3 text-sm font-semibold text-surface hover:bg-ink disabled:opacity-50"><Plus className="h-4 w-4" />Add member</button>)}
    </DialogContent>
  </Dialog>;
}

function ExpenseActions({ slug, members }: { slug: string; members: { resolvedId: string; id: string; name: string; claimed: boolean }[] }) {
  const navigate = useNavigate();
  function handleNewExpense() {
    const params = encodeDraftParams(members.map(m => ({ id: m.resolvedId, name: m.name })), true);
    void navigate({
      to: "/e/$slug",
      params: { slug: generateSlug() },
      search: { ...(Object.fromEntries(params) as { count?: string; names?: string; ids?: string }), tab: slug },
    });
  }
  return <>
    <button type="button" onClick={handleNewExpense} className="inline-flex items-center gap-2 rounded-lg bg-forest px-5 py-3 text-sm font-semibold text-surface transition hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"><Plus className="h-4 w-4" />Add expense</button>
  </>;
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
  async function deleteExpense() {
    if (!selected) return;
    setPending(true); setError(null);
    try {
      await remove(selected.slug);
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
        <button type="button" aria-haspopup="dialog" onClick={() => { setSelectedSlug(expense.slug); setConfirmDelete(false); setError(null); }} className={`${expenseRowGrid} w-full py-4 text-left transition-colors hover:bg-[#f3ead8] focus-visible:bg-[#f3ead8] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest`}>
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
      {selected && split && <DialogContent key={selected.slug} aria-label="Expense details" className="flex max-h-[calc(100dvh-5rem)] flex-col overflow-hidden p-0 sm:p-0">
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3"><DialogTitle>{selected.name ?? "Untitled expense"}</DialogTitle><DialogClose aria-label="Close expense details" className="rounded-md p-1 text-ink-soft hover:bg-[#f3ead8]"><X className="h-5 w-5" /></DialogClose></div>
        <p className="mt-5 font-numeric text-2xl font-semibold">{currency(split.grandTotal, selected.currency)}</p><p className="mt-1 text-sm text-ink-soft">{selected.currency}{selected.mode === "itemized" && <> · {selected.items.length} {selected.items.length === 1 ? "item" : "items"}</>}</p>
        <ExpenseMetadata expense={selected} />
        {selected.note && <section className="mt-5 border-t border-rule/70 pt-5">
          <h4 className="text-sm font-semibold">Note</h4>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-ink-soft">{selected.note}</p>
        </section>}
        {selected.image && <section className="mt-5 border-t border-rule/70 pt-5">
          <h4 className="text-sm font-semibold">Receipt</h4>
          {selected.image.url ? <a href={selected.image.url} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-3 rounded-lg border border-rule/70 p-3 text-sm text-forest transition hover:bg-[#f3ead8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
            {selected.image.type !== "application/pdf" ? (
              <img src={selected.image.url} alt="" className="h-12 w-12 shrink-0 rounded-md border border-rule/70 object-cover" />
            ) : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-paper"><FileText className="h-5 w-5" /></span>}
            <span className="min-w-0 flex-1"><span className="block break-words">{selected.image.name}</span><span className="mt-0.5 block text-xs text-ink-soft">{selected.image.type === "application/pdf" ? "PDF receipt" : "Receipt image"}</span></span>
            <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" /><span className="sr-only"> (opens in a new tab)</span>
          </a> : <p className="mt-2 text-sm text-ink-soft">This receipt is no longer available.</p>}
        </section>}

        {selected.currency !== defaultCurrency && <ExchangeRateForm key={`${selected.slug}:${selected.currency}:${defaultCurrency}:${selected.exchangeRate?.rate ?? "none"}`} tabSlug={slug} expense={selected} target={defaultCurrency} canEdit={isOwner} />}
        <h4 className="mt-6 border-t border-rule/70 pt-5 text-sm font-semibold">Split with</h4><ul className="mt-3 space-y-3">{split.people.map(person => <li key={person.personId} className="flex items-center gap-2 text-sm"><MemberAvatar id={person.personId} name={person.name} /><span className="min-w-0 flex-1 break-words">{person.name}</span><span className="font-numeric">{currency(person.total, selected.currency)}</span></li>)}</ul>
        {selected.mode === "itemized" && <details className="group mt-6 border-t border-rule/70 pt-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">Items · {split.items.length}<ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></summary>
          <ul className="mt-3 space-y-3">{split.items.map(item => <li key={item.itemId} className="flex justify-between gap-3 text-sm"><span className="min-w-0 break-words">{item.itemName}</span><span className="font-numeric shrink-0">{currency(item.total, selected.currency)}</span></li>)}</ul>
        </details>}
        </div>
        <footer className="shrink-0 border-t border-rule/70 bg-surface px-5 py-4 sm:px-6">
        {isOwner && <div className="flex flex-wrap gap-2">
          <Link to="/e/$slug" params={{ slug: selected.slug }} className="inline-flex items-center gap-2 rounded-lg border border-rule px-3 py-2 text-sm hover:bg-[#f3ead8]"><Pencil className="h-4 w-4" />Edit</Link>
          <button type="button" disabled={pending} onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-2 rounded-lg border border-rule px-3 py-2 text-sm text-margin-red hover:bg-[#f3ead8] disabled:opacity-50"><Trash2 className="h-4 w-4" />Delete</button>
        </div>}
        {confirmDelete && <div className="mt-3 text-sm"><p>Delete this expense permanently?</p><div className="mt-2 flex gap-3"><button disabled={pending} onClick={() => void deleteExpense()} className="font-semibold text-margin-red">Confirm delete</button><button disabled={pending} onClick={() => setConfirmDelete(false)}>Cancel</button></div></div>}
        {error && <p role="alert" className="mt-3 text-sm text-margin-red">{error}</p>}
        {!isOwner && <DialogClose className="rounded-lg border border-rule px-3 py-2 text-sm hover:bg-[#f3ead8]">Done</DialogClose>}
        </footer>
      </DialogContent>}
    </Dialog>
  </section>;
}

function ExchangeRateForm({ tabSlug, expense, target, canEdit }: { tabSlug: string; expense: ReturnType<typeof useTabExpenses>[number]; target: string; canEdit: boolean }) {
  const { setExpenseExchangeRate } = useTabActions();
  const [value, setValue] = useState(expense.exchangeRate?.rate.toString() ?? "");
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rate = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(rate) && rate > 0;
  async function save(next: number | null) {
    setPending(true); setError(null);
    try { await setExpenseExchangeRate({ slug: tabSlug, expenseSlug: expense.slug, from: expense.currency, to: target, rate: next }); setExpanded(false); }
    catch (err) { setError(err instanceof Error ? err.message : "Couldn't save the exchange rate."); }
    finally { setPending(false); }
  }
  return <form onSubmit={event => { event.preventDefault(); if (valid) void save(rate); }} className="mt-5 rounded-lg border border-rule bg-paper p-4">
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h4 className="text-sm font-semibold">{expense.exchangeRate ? currency(computeSplit(expense.people, expense.items).grandTotal * expense.exchangeRate.rate, target) : `Exchange to ${target}`}</h4>
        <p className="mt-1 text-xs text-ink-soft">{expense.exchangeRate ? `Included in ${target} balances · 1 ${expense.currency} = ${expense.exchangeRate.rate} ${target}` : `No rate added. This expense stays in ${expense.currency} balances.`}</p>
      </div>
      {canEdit && <button type="button" disabled={pending} aria-expanded={expanded} aria-controls="exchange-rate-fields" onClick={() => setExpanded(!expanded)} className="shrink-0 text-xs font-medium text-forest underline underline-offset-4">{expanded ? "Cancel" : expense.exchangeRate ? "Change" : "Add rate"}</button>}
    </div>
    {canEdit && expanded && <div id="exchange-rate-fields">
      {!expense.exchangeRate && <p className="mt-3 text-xs text-ink-soft">Add a rate to include this expense and its payments in the tab’s {target} balance.</p>}
      <label htmlFor="expense-exchange-rate" className="mt-3 flex items-center gap-2 text-sm">
        <span className="shrink-0">1 {expense.currency} =</span>
        <input id="expense-exchange-rate" type="number" inputMode="decimal" step="any" min="0" required value={value} disabled={pending} onChange={event => setValue(event.target.value)} placeholder="e.g. 1.38" aria-describedby="exchange-preview" className="w-full min-w-0 rounded-md border border-rule bg-surface px-3 py-2 font-numeric outline-none focus:ring-2 focus:ring-forest/30" />
        <span>{target}</span>
      </label>
      <p id="exchange-preview" aria-live="polite" className="mt-2 text-xs text-ink-soft">{valid ? `Converted total: ${currency(computeSplit(expense.people, expense.items).grandTotal * rate, target)}` : "Enter a rate greater than zero."}</p>
      <div className="mt-3 flex gap-3"><button disabled={!valid || pending} className="rounded-md bg-forest px-3 py-2 text-xs font-medium text-white disabled:opacity-50">{pending ? "Saving…" : "Save rate"}</button>{expense.exchangeRate && <button type="button" disabled={pending} onClick={() => void save(null)} className="text-xs text-ink-soft hover:text-margin-red">Remove rate</button>}</div>
    </div>}
    {error && <p role="alert" className="mt-2 text-xs text-margin-red">{error}</p>}
  </form>;
}
