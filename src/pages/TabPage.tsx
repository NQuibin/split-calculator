import { type FormEvent, useEffect, useRef, useState } from "react";
import { ExpenseViewTabs, type ExpenseView } from "@/components/ExpenseViewTabs";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { api } from "../../convex/_generated/api";
import { MemberAvatar } from "@/components/MemberAvatar";
import { UpcomingExpenseIcon, UpcomingExpenseLegend } from "@/components/UpcomingExpenseIcon";
import { useConvexAuth, useQuery } from "convex/react";
import {
  ArrowUpRight,
  FileText,
  Check,
  ChevronDown,
  Search,
  X,
  Coins,
  HatGlasses,
  Link2,
  Pencil,
  Plus,
  Receipt,
  Trash2,
} from "lucide-react";
import { TabBreakdown } from "@/components/TabBreakdown";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CurrencyFilter } from "@/components/ui/CurrencyFilter";
import { CurrencyPicker } from "@/components/ui/CurrencyPicker";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/Dialog";
import { BASE_PATH } from "@/lib/basePath";
import { computeSplit } from "@/lib/calculations";
import { currency, formatExpenseDate, isUpcoming } from "@/lib/format";
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
import { GroupTitle, PageTitle, SectionTitle } from "@/components/ui/Typography";
import { Page } from "@/components/ui/Page";
import { Breadcrumb, BreadcrumbCurrent, crumbLinkClass } from "@/components/ui/Breadcrumb";
import { OverflowAction, OverflowMenu } from "@/components/ui/OverflowMenu";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TabSettlement } from "@/components/TabSettlement";
import { ExpenseBalances } from "@/components/ExpenseBalances";

const route = getRouteApi("/t/$slug/");


/**
 * An arriving invite is claimed *before* the tab itself is read. Everything
 * below the claim - expenses, balances, the roster - is member-only on the
 * server, so rendering it while the visitor is still an outsider would just
 * bounce them to the forbidden page a moment before they're let in.
 */
export function TabPage() {
  const { slug } = route.useParams();
  const { token } = route.useSearch();
  const { isLoading } = useConvexAuth();
  const claim = useInviteClaim(slug, token);

  if (isLoading || claim.status === "claiming") {
    return <Page width="wide"><p role="status" className="text-sm text-ink-soft">{claim.status === "claiming" ? "Joining tab…" : "Loading tab…"}</p></Page>;
  }
  if (claim.status === "needsSignIn") return <InviteSignIn slug={slug} token={token!} />;

  return <TabView slug={slug} claimError={claim.status === "error" ? claim.message : undefined} />;
}

type ClaimState =
  | { status: "none" | "needsSignIn" | "claiming" | "done" }
  | { status: "error"; message: string };

function useInviteClaim(slug: string, token: string | undefined): ClaimState {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { claimMember } = useTabActions();
  const attempted = useRef(false);
  const [result, setResult] = useState<ClaimState | null>(null);
  const canClaim = Boolean(token) && !isLoading && isAuthenticated;

  useEffect(() => {
    if (!token || !canClaim || attempted.current) return;
    attempted.current = true;
    claimMember({ slug, token })
      .then(() => setResult({ status: "done" }))
      .catch((err) =>
        setResult({ status: "error", message: err instanceof Error ? err.message : "Couldn't claim this invite." }),
      );
  }, [canClaim, claimMember, slug, token]);

  if (!token) return { status: "none" };
  if (result) return result;
  // Auth still resolving counts as claiming: the visitor may well be signed
  // in, and flashing a sign-in prompt at them would be wrong.
  return isLoading || isAuthenticated ? { status: "claiming" } : { status: "needsSignIn" };
}

/** All an unclaimed invite shows a signed-out visitor: which tab it's for. */
function InviteSignIn({ slug, token }: { slug: string; token: string }) {
  const tab = useTab(slug, token);

  if (tab === undefined) return <Page width="wide"><p role="status" className="text-sm text-ink-soft">Loading invite…</p></Page>;
  if (tab === null) {
    return (
      <Page width="narrow" center className="text-center">
        <p className="text-ink-soft">This tab doesn&rsquo;t exist.</p>
      </Page>
    );
  }

  return (
    <Page width="narrow" center>
      <div className="rounded-xl border border-rule/70 bg-surface/80 px-6 py-8 text-center sm:px-8">
        <span aria-hidden="true" className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-forest/10 text-forest"><Receipt className="h-6 w-6" strokeWidth={2.25} /></span>
        <PageTitle className="mt-5 text-2xl">You&rsquo;ve been invited to {tab.name}</PageTitle>
        <p className="mx-auto mt-3 max-w-sm text-sm text-ink-soft">
          Sign in to claim your spot. Your place in the tab, and everything in it, opens up once you do.
        </p>
      </div>
    </Page>
  );
}

function TabView({ slug, claimError }: { slug: string; claimError?: string }) {
  const tab = useTab(slug);
  const breakdown = useTabBreakdown(slug);
  const expenses = useQuery(api.tabs.expensesForTab, { slug });
  const [expenseView, setExpenseView] = useState<ExpenseView>("paid");
  const hasUpcoming = expenses?.some(expense => isUpcoming(expense.date)) ?? false;
  if (!hasUpcoming && expenseView !== "paid") setExpenseView("paid");

  if (tab === undefined || expenses === undefined) return <Page width="wide"><p role="status" className="text-sm text-ink-soft">Loading tab…</p></Page>;
  if (tab === null) {
    return (
      <Page width="narrow" center className="text-center">
        <p className="text-ink-soft">This tab doesn&rsquo;t exist.</p>
      </Page>
    );
  }

  const tabContent = <>
      {breakdown && <div><TabBreakdown expenseView={expenseView} expenses={expenses} hasUpcoming={hasUpcoming} tabSlug={slug} currencies={breakdown.currencies} members={tab.members} /></div>}
      <div className="mt-7"><ExpenseList expenseView={expenseView} defaultCurrency={tab.defaultCurrency} slug={slug} isOwner={tab.isOwner} members={tab.members} expenses={expenses} /></div>
  </>;

  return (
    <Page width="wide">
      <Breadcrumb>
        <Link to="/tabs" className={crumbLinkClass}>Tabs</Link>
        <BreadcrumbCurrent>{tab.name}</BreadcrumbCurrent>
      </Breadcrumb>
      {claimError && (
        <p role="status" className="mb-6 rounded-md border border-rule bg-surface p-4 text-sm text-ink">{claimError}</p>
      )}
      <header className="mb-7 flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <TabTitle slug={slug} name={tab.name} isOwner={tab.isOwner} />
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-soft">
            <Roster slug={slug} isOwner={tab.isOwner} members={tab.members} />
            {tab.isOwner ? <TabDefaultCurrency slug={slug} currency={tab.defaultCurrency} /> : <span className="inline-flex items-center gap-2"><Coins aria-hidden="true" className="h-3.5 w-3.5 text-brass" strokeWidth={2.25} />Tab currency · {tab.defaultCurrency}</span>}
          </div>
        </div>
        {tab.isOwner && <TabOwnerActions slug={slug} members={tab.members} expenseCount={expenses.length} />}
      </header>
      <TabSettlement slug={slug} members={tab.members} isOwner={tab.isOwner} />
      {hasUpcoming ? <ExpenseViewTabs value={expenseView} onChange={setExpenseView} label="Tab expense date">{tabContent}</ExpenseViewTabs> : tabContent}
    </Page>
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
        <Input
          autoFocus
          aria-label="Tab name"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleSubmit}
          className="font-display max-w-sm text-2xl! font-semibold"
        />
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <PageTitle className="sm:text-4xl">{name}</PageTitle>
        {isOwner && (
          <Button
            type="button"
            variant="ghost"
            size="icon-touch"
            onClick={() => {
              setValue(name);
              setEditing(true);
            }}
            aria-label="Rename tab"
            className="text-ink-soft hover:text-forest"
          >
            <Pencil className="h-4 w-4" strokeWidth={2.25} />
          </Button>
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

/**
 * The owner's action cluster. "Add expense" is the one action that earns a
 * button of its own; deleting the tab is rare and destructive, so it lives
 * behind the overflow menu (DESIGN.md § 6). The confirm dialog is a sibling
 * of the menu, not a child - a menu item unmounts when the menu closes, and
 * would take its dialog with it.
 */
function TabOwnerActions({ slug, members, expenseCount }: { slug: string; members: { resolvedId: string; id: string; name: string; claimed: boolean }[]; expenseCount: number }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <ExpenseActions slug={slug} members={members} />
      <OverflowMenu label="More tab actions">
        <OverflowAction destructive onClick={() => setConfirming(true)}>
          <Trash2 />Delete tab
        </OverflowAction>
      </OverflowMenu>
      <DeleteTabDialog slug={slug} expenseCount={expenseCount} open={confirming} onOpenChange={setConfirming} />
    </div>
  );
}

function DeleteTabDialog({ slug, expenseCount, open, onOpenChange }: { slug: string; expenseCount: number; open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const { deleteTab } = useTabActions();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete this tab?"
      description={expenseCount === 0
        ? "This permanently deletes the tab. This can’t be undone."
        : `This permanently deletes the tab and its ${expenseCount} ${expenseCount === 1 ? "expense" : "expenses"}. This can’t be undone.`}
      confirmLabel="Delete tab"
      pendingLabel="Deleting…"
      onConfirm={async () => { await deleteTab({ slug }); void navigate({ to: "/tabs" }); }}
    />
  );
}

function Roster({ slug, isOwner, members }: {
  slug: string;
  isOwner: boolean;
  members: { id: string; name: string; claimed: boolean; resolvedId: string }[];
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
    <Input autoFocus aria-label="Member name" placeholder="Name" value={name} disabled={pending} onChange={event => setName(event.target.value)} className="flex-1 basis-40" />
    <Button type="submit" size="lg" disabled={pending || !name.trim()} aria-busy={pending}>{pending ? "Saving…" : adding ? "Add" : "Save"}</Button>
    <Button type="button" variant="outline" size="lg" disabled={pending} onClick={resetForm}>Cancel</Button>
  </form>;

  return <Dialog open={open} onOpenChange={next => { if (!pending) { setOpen(next); resetForm(); } }}>
    <DialogTrigger aria-label={`View ${members.length} ${members.length === 1 ? "member" : "members"}`} className="group inline-flex min-h-11 items-center gap-2.5 rounded-lg px-1 text-sm text-ink-soft transition hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
      {members.length > 0 && <span aria-hidden="true" className="flex -space-x-2">
        {members.slice(0, 5).map(member => <MemberAvatar key={member.id} id={member.id} name={member.name} className="ring-2 ring-paper" />)}
        {members.length > 5 && <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface text-xs font-semibold ring-2 ring-paper">+{members.length - 5}</span>}
      </span>}
      <span>{members.length} {members.length === 1 ? "member" : "members"}</span>
      {/* Chevron, not an arrow: this opens the members dialog in place rather
          than navigating away. */}
      <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 chevron-y" />
    </DialogTrigger>
    <DialogContent>
      <div className="flex items-start justify-between gap-3">
        <div><DialogTitle>Members</DialogTitle><DialogDescription className="mt-1">{members.length} {members.length === 1 ? "person" : "people"} in this tab</DialogDescription></div>
        <DialogClose disabled={pending} aria-label="Close members" render={<Button variant="ghost" size="icon-touch" className="text-ink-soft" />}><X className="h-5 w-5" /></DialogClose>
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
                <Button type="button" variant="ghost" size="icon-touch" disabled={pending} aria-label={`Edit ${member.name}`} onClick={() => { resetForm(); setEditingId(member.id); setName(member.name); }} className="text-ink-soft hover:text-forest"><Pencil className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="icon-touch" disabled={pending} aria-label={`Remove ${member.name}`} onClick={() => { resetForm(); setRemovingId(member.id); }} className="text-ink-soft hover:text-margin-red-ink"><Trash2 className="h-4 w-4" /></Button>
              </div>}
            </div>
            {isOwner && !member.claimed && invite && <Button type="button" variant="link" size="xs" onClick={() => void copyInvite(member.id, invite.token)} className="mt-2 h-auto px-0 text-xs no-underline hover:text-ink hover:no-underline">{copiedId === member.id ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}{copiedId === member.id ? "Copied" : "Copy invite"}</Button>}
            {isOwner && editingId === member.id && memberForm}
            {isOwner && removingId === member.id && <div className="mt-3 text-sm"><p>Remove {member.name} from this tab?</p><div className="mt-2 flex gap-3"><Button type="button" variant="link" size="xs" disabled={pending} onClick={() => void handleRemove(member.id)} className="h-auto px-0 text-sm font-semibold text-margin-red-ink no-underline">{pending ? "Removing…" : "Remove member"}</Button><Button type="button" variant="link" size="xs" disabled={pending} onClick={resetForm} className="h-auto px-0 text-sm text-ink-soft no-underline">Cancel</Button></div></div>}
          </li>;
        })}
      </ul>
      {!members.length && <p className="mt-4 text-sm text-ink-soft">No members yet.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-margin-red-ink">{error}</p>}
      {isOwner && (adding ? memberForm : <Button type="button" size="touch" disabled={pending} onClick={() => { resetForm(); setAdding(true); }} className="mt-6 w-full"><Plus className="h-4 w-4" />Add member</Button>)}
    </DialogContent>
  </Dialog>;
}

function ExpenseActions({ slug, members }: { slug: string; members: { resolvedId: string; id: string; name: string; claimed: boolean }[] }) {
  const navigate = useNavigate();
  function handleNewExpense() {
    const params = encodeDraftParams(members.map(m => ({ id: m.resolvedId, name: m.name })));
    void navigate({
      to: "/e/$slug",
      params: { slug: generateSlug() },
      search: { ...(Object.fromEntries(params) as { count?: string; names?: string; ids?: string }), tab: slug },
    });
  }
  return <>
    <Button type="button" size="touch" onClick={handleNewExpense}><Plus className="h-4 w-4" />Add expense</Button>
  </>;
}

// One grid template shared by the expense list's header and its rows so the
// columns line up. Every track but the first is a fixed width: each row is its
// own grid, so an `auto` track would size to that row's own content and the
// columns would drift out of alignment with each other. Below `md` the middle
// columns collapse into a metadata line underneath the name, leaving
// expense / amount. The last track is the row's own actions menu, which is a
// sibling of the row trigger rather than a child - a button can't nest inside
// a button (see DESIGN.md § 5, "Interactive rows").
const expenseRowGrid =
  "grid grid-cols-[minmax(0,1fr)_6.5rem_2.75rem] items-center gap-x-4 gap-y-3 px-5 md:grid-cols-[minmax(0,1fr)_7rem_9rem_7.5rem_6.5rem_2.75rem]";

/** One expense row's actions. A sibling of the row trigger, never a child. */
function ExpenseRowMenu({ expenseSlug, name, onDelete }: { expenseSlug: string; name: string; onDelete: () => void }) {
  return (
    <OverflowMenu label={`Actions for ${name}`}>
      <OverflowAction render={<Link to="/e/$slug" params={{ slug: expenseSlug }} />}>
        <Pencil />Edit expense
      </OverflowAction>
      <OverflowAction destructive onClick={onDelete}>
        <Trash2 />Delete expense
      </OverflowAction>
    </OverflowMenu>
  );
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
  const date = formatExpenseDate(expense.date);
  return <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-soft">
    <span><span className="mr-1 font-medium">Date</span>{date ? <time dateTime={expense.date}>{date}</time> : "Not set"}</span>
    <span className="inline-flex items-center gap-2"><span className="font-medium">Created by</span>{expense.createdBy && <MemberAvatar id={expense.createdBy.id} name={expense.createdBy.name} />}<span>{expense.createdBy?.name ?? "Unknown creator"}</span></span>
  </span>;
}

function ExpenseList({ slug, defaultCurrency, isOwner, members, expenses, expenseView }: {
  expenseView: ExpenseView;
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
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const codes = [...new Set(expenses.map(e => e.settlementCurrency))].sort();
  const hasUpcoming = expenses.some(expense => isUpcoming(expense.date));
  const activeView = hasUpcoming ? expenseView : "all";
  const visibleExpenses = expenses.filter(expense => activeView === "all" || (activeView === "upcoming" ? isUpcoming(expense.date) : !isUpcoming(expense.date)));
  const filtered = visibleExpenses.filter(e => (currencyFilter === "all" || e.settlementCurrency === currencyFilter) && (e.name ?? "Untitled expense").toLowerCase().includes(search.trim().toLowerCase()));
  const selected = expenses.find(e => e.slug === selectedSlug);
  const split = selected ? computeSplit(selected.people, selected.items, selected.globalAdjustments) : null;
  const payerFor = (payerId: string | undefined) => members.find(member => member.id === payerId || member.resolvedId === payerId);
  const payerLabel = (expense: typeof expenses[number]) => {
    const payer = payerFor(expense.payerId);
    if (isUpcoming(expense.date)) return payer ? `Planned ${payer.name}` : "Not paid yet";
    return payer?.name ?? "Payer needed";
  };
  async function deleteExpense() {
    if (!selected) return;
    setPending(true); setError(null);
    try {
      await remove(selected.slug);
      setSelectedSlug(null); setConfirmDelete(false);
    } catch (err) { setError(err instanceof Error ? err.message : "Couldn't update the expense."); }
    finally { setPending(false); }
  }
  const expenseRows = <>
    <div className="overflow-hidden rounded-lg border border-edge bg-field">
      <div className={`${expenseRowGrid} border-b border-rule/70 bg-band py-3 text-xs font-medium uppercase text-ink-soft`}>
        <span>Expense</span>
        <span className="hidden md:block">Date</span>
        <span className="hidden text-center md:block">Paid by</span>
        <span className="hidden text-center md:block">Split with</span>
        <span className="text-right">Amount</span>
        <span className="sr-only">Actions</span>
      </div>
      {!filtered.length ? <p role="status" className="p-8 text-center text-sm text-ink-soft">{!expenses.length ? "No expenses yet. Add one to get started." : !visibleExpenses.length && activeView === "paid" ? "No paid expenses yet. Check Upcoming for planned expenses." : "No expenses match your filters."}</p> : <ul className="divide-y divide-rule/70">{filtered.map(expense => <li key={expense.slug}>
        <div className={`${expenseRowGrid} relative py-4 transition-colors hover:bg-wash has-[button:focus-visible]:bg-wash`}>
          {/* The trigger covers the row through its ::after overlay, so the
              whole row stays tappable while the actions menu sits above it. */}
          <button type="button" aria-haspopup="dialog" onClick={() => { setSelectedSlug(expense.slug); setConfirmDelete(false); setError(null); }} className="min-w-0 text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-forest">
              <span className="block font-semibold break-words">{expense.name ?? "Untitled expense"}</span>
              <span className="block text-xs text-ink-soft">{expense.items.length} {expense.items.length === 1 ? "item" : "items"}</span>
          </button>
          <span className="hidden items-center gap-1.5 text-sm text-ink-soft md:flex">
            <UpcomingExpenseIcon date={expense.date} />
            {expense.date ? <time dateTime={expense.date}>{formatExpenseDate(expense.date)}</time> : "Not set"}
          </span>
          <span className="hidden min-w-0 items-center justify-center gap-2 text-sm md:flex">
            {payerFor(expense.payerId) && <MemberAvatar id={payerFor(expense.payerId)!.id} name={payerFor(expense.payerId)!.name} size="sm" />}
            <span className="truncate">{payerLabel(expense)}</span>
          </span>
          <span className="hidden justify-center md:flex"><AvatarStack people={expense.people} /></span>
          <span className="text-right"><span className="block font-numeric text-sm font-semibold">{currency(computeSplit(expense.people, expense.items, expense.globalAdjustments).grandTotal * (expense.exchangeRate?.rate ?? 1), expense.settlementCurrency)}</span><span className="block text-xs text-ink-soft">{expense.exchangeRate ? `${currency(computeSplit(expense.people, expense.items, expense.globalAdjustments).grandTotal, expense.currency)} · converted` : expense.currency}</span></span>
          <div className="relative z-10 col-start-3 row-start-1 flex justify-end md:col-start-6">
            {isOwner && <ExpenseRowMenu expenseSlug={expense.slug} name={expense.name ?? "Untitled expense"} onDelete={() => setDeletingSlug(expense.slug)} />}
          </div>
          <span className="col-span-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-ink-soft md:hidden">
            {expense.date && <span className="inline-flex items-center gap-1.5"><UpcomingExpenseIcon date={expense.date} /><time dateTime={expense.date}>{formatExpenseDate(expense.date)}</time></span>}
            <span className="inline-flex items-center gap-1.5">{payerFor(expense.payerId) && <MemberAvatar id={payerFor(expense.payerId)!.id} name={payerFor(expense.payerId)!.name} size="sm" />}{payerLabel(expense)}</span>
            <AvatarStack people={expense.people} />
          </span>
        </div>
      </li>)}</ul>}
    </div>
    {filtered.some(expense => isUpcoming(expense.date)) && <UpcomingExpenseLegend />}
    <ConfirmDialog
      open={deletingSlug !== null}
      onOpenChange={next => { if (!next) setDeletingSlug(null); }}
      title="Delete this expense?"
      description={deletingSlug ? `“${expenses.find(e => e.slug === deletingSlug)?.name ?? "Untitled expense"}” and its itemized split will be deleted permanently. This can’t be undone.` : null}
      confirmLabel="Delete expense"
      pendingLabel="Deleting…"
      onConfirm={async () => { if (deletingSlug) await remove(deletingSlug); }}
    />
  </>;
  return <section aria-label="Expenses" className="rounded-xl border border-rule/70 bg-surface/80 p-5 sm:p-6">
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <SectionTitle className="mr-auto flex items-center gap-2">
        <Receipt aria-hidden="true" className="h-5 w-5 shrink-0 text-brass" strokeWidth={2.25} />
        Expenses <span className="text-sm font-normal text-ink-soft">{filtered.length}</span>
      </SectionTitle>
      <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-edge bg-field px-3 focus-within:ring-2 focus-within:ring-forest/20 sm:max-w-sm"><Search className="h-4 w-4 text-ink-soft" /><input aria-label="Search tab expenses" placeholder="Search expenses…" value={search} onChange={e => setSearch(e.target.value)} className="w-full min-w-0 bg-transparent text-base outline-none sm:text-xs" /></label>
      <CurrencyFilter value={currencyFilter} onChange={setCurrencyFilter} codes={codes} label="Filter by currency" />
    </div>
    {expenseRows}
    <Dialog open={Boolean(selected)} onOpenChange={next => { if (!next) { setSelectedSlug(null); setConfirmDelete(false); setError(null); } }}>
      {selected && split && <DialogContent key={selected.slug} aria-label="Expense details" className="flex max-h-[calc(100dvh-5rem)] flex-col overflow-hidden p-0 sm:p-0">
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3"><DialogTitle>{selected.name ?? "Untitled expense"}</DialogTitle><DialogClose aria-label="Close expense details" render={<Button variant="ghost" size="icon-touch" className="text-ink-soft" />}><X className="h-5 w-5" /></DialogClose></div>
        <p className="mt-5 font-numeric text-2xl font-semibold">{currency(split.grandTotal, selected.currency)}</p><p className="mt-1 text-sm text-ink-soft">{selected.currency}{selected.mode === "itemized" && <> · {selected.items.length} {selected.items.length === 1 ? "item" : "items"}</>}</p>
        <ExpenseMetadata expense={selected} />
        <p className="mt-3 text-sm text-ink-soft">{isUpcoming(selected.date) ? "Planned payer" : "Paid by"}: <span className="text-ink">{payerFor(selected.payerId)?.name ?? (isUpcoming(selected.date) ? "Not set" : "Payer needed")}</span></p>
        <ExpenseBalances people={selected.people} split={split} payerId={selected.payerId} currency={selected.currency} projected={isUpcoming(selected.date)} unallocated={selected.items.some(item => item.splitWith.length === 0)} headingLevel="h3" />
        {selected.note && <section className="mt-5 border-t border-rule/70 pt-5">
          <GroupTitle as="h4">Note</GroupTitle>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-ink-soft">{selected.note}</p>
        </section>}
        {selected.image && <section className="mt-5 border-t border-rule/70 pt-5">
          <GroupTitle as="h4">Receipt</GroupTitle>
          {selected.image.url ? <a href={selected.image.url} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-3 rounded-lg border border-rule/70 p-3 text-sm text-forest transition hover:bg-wash focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
            {selected.image.type !== "application/pdf" ? (
              <img src={selected.image.url} alt="" className="h-12 w-12 shrink-0 rounded-md border border-rule/70 object-cover" />
            ) : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-paper"><FileText className="h-5 w-5" /></span>}
            <span className="min-w-0 flex-1"><span className="block break-words">{selected.image.name}</span><span className="mt-0.5 block text-xs text-ink-soft">{selected.image.type === "application/pdf" ? "PDF receipt" : "Receipt image"}</span></span>
            <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" /><span className="sr-only"> (opens in a new tab)</span>
          </a> : <p className="mt-2 text-sm text-ink-soft">This receipt is no longer available.</p>}
        </section>}

        {selected.currency !== defaultCurrency && <ExchangeRateForm key={`${selected.slug}:${selected.currency}:${defaultCurrency}:${selected.exchangeRate?.rate ?? "none"}`} tabSlug={slug} expense={selected} target={defaultCurrency} canEdit={isOwner} />}
        <GroupTitle as="h4" className="mt-6 border-t border-rule/70 pt-5">Split with</GroupTitle><ul className="mt-3 space-y-3">{split.people.map(person => <li key={person.personId} className="flex items-center gap-2 text-sm"><MemberAvatar id={person.personId} name={person.name} /><span className="min-w-0 flex-1 break-words">{person.name}</span><span className="font-numeric">{currency(person.total, selected.currency)}</span></li>)}</ul>
        {selected.mode === "itemized" && <details className="group mt-6 border-t border-rule/70 pt-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">Items · {split.items.length}<ChevronDown className="h-4 w-4 chevron-flip" /></summary>
          <ul className="mt-3 space-y-3">{split.items.map(item => <li key={item.itemId} className="flex justify-between gap-3 text-sm"><span className="min-w-0 break-words">{item.itemName}</span><span className="font-numeric shrink-0">{currency(item.total, selected.currency)}</span></li>)}</ul>
        </details>}
        </div>
        <footer className="shrink-0 border-t border-rule/70 bg-surface px-5 py-4 sm:px-6">
        {isOwner && <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="touch" render={<Link to="/e/$slug" params={{ slug: selected.slug }} />}><Pencil className="h-4 w-4" />Edit</Button>
          <Button type="button" variant="destructive" size="touch" disabled={pending} onClick={() => setConfirmDelete(true)}><Trash2 className="h-4 w-4" />Delete</Button>
        </div>}
        {confirmDelete && <div className="mt-3 text-sm"><p>Delete this expense permanently?</p><div className="mt-2 flex gap-3"><Button type="button" variant="link" size="xs" disabled={pending} onClick={() => void deleteExpense()} className="h-auto px-0 text-sm font-semibold text-margin-red-ink no-underline">Confirm delete</Button><Button type="button" variant="link" size="xs" disabled={pending} onClick={() => setConfirmDelete(false)} className="h-auto px-0 text-sm text-ink-soft no-underline">Cancel</Button></div></div>}
        {error && <p role="alert" className="mt-3 text-sm text-margin-red-ink">{error}</p>}
        {!isOwner && <DialogClose render={<Button variant="outline" size="touch" />}>Done</DialogClose>}
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
        <GroupTitle as="h4">{expense.exchangeRate ? currency(computeSplit(expense.people, expense.items, expense.globalAdjustments).grandTotal * expense.exchangeRate.rate, target) : `Exchange to ${target}`}</GroupTitle>
        <p className="mt-1 text-xs text-ink-soft">{expense.exchangeRate ? `Included in ${target} totals · 1 ${expense.currency} = ${expense.exchangeRate.rate} ${target}` : `No rate added. This expense stays in ${expense.currency} totals.`}</p>
      </div>
      {canEdit && <Button type="button" variant="link" size="xs" disabled={pending} aria-expanded={expanded} aria-controls="exchange-rate-fields" onClick={() => setExpanded(!expanded)} className="h-auto shrink-0 px-0 text-xs underline-offset-4">{expanded ? "Cancel" : expense.exchangeRate ? "Change" : "Add rate"}</Button>}
    </div>
    {canEdit && expanded && <div id="exchange-rate-fields">
      {!expense.exchangeRate && <p className="mt-3 text-xs text-ink-soft">Add a rate to include this expense in the tab’s {target} totals.</p>}
      <label htmlFor="expense-exchange-rate" className="mt-3 flex items-center gap-2 text-sm">
        <span className="shrink-0">1 {expense.currency} =</span>
        <Input id="expense-exchange-rate" type="number" inputMode="decimal" step="any" min="0" required value={value} disabled={pending} onChange={event => setValue(event.target.value)} placeholder="e.g. 1.38" aria-describedby="exchange-preview" className="bg-surface font-numeric" />
        <span>{target}</span>
      </label>
      <p id="exchange-preview" aria-live="polite" className="mt-2 text-xs text-ink-soft">{valid ? `Converted total: ${currency(computeSplit(expense.people, expense.items, expense.globalAdjustments).grandTotal * rate, target)}` : "Enter a rate greater than zero."}</p>
      <div className="mt-3 flex gap-3"><Button type="submit" size="lg" disabled={!valid || pending} aria-busy={pending}>{pending ? "Saving…" : "Save rate"}</Button>{expense.exchangeRate && <Button type="button" variant="destructive" size="lg" disabled={pending} onClick={() => void save(null)}>Remove rate</Button>}</div>
    </div>}
    {error && <p role="alert" className="mt-2 text-xs text-margin-red-ink">{error}</p>}
  </form>;
}
