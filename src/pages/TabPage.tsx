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
  X,
  Coins,
  Link2,
  Pencil,
  Plus,
  Receipt,
  Settings,
  Trash2,
} from "lucide-react";
import { TabBreakdown } from "@/components/TabBreakdown";
import { Button } from "@/components/ui/Button";
import { AnonymousBadge } from "@/components/ui/AnonymousBadge";
import { Field, Input, Label } from "@/components/ui/Input";
import { SearchField } from "@/components/ui/SearchField";
import { CurrencyFilter } from "@/components/ui/CurrencyFilter";
import { CurrencyPicker } from "@/components/ui/CurrencyPicker";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";
import { BASE_PATH } from "@/lib/basePath";
import { computeSplit } from "@/lib/calculations";
import { currency, formatExpenseDate, formatExpenseDateShort, isUpcoming } from "@/lib/format";
import {
  useTab,
  useTabActions,
  useTabBreakdown,
  useTabInviteLinks,
  type useTabExpenses,
} from "@/lib/tabSync";
import { encodeDraftParams } from "@/lib/expenseDraft";
import { useExpenseActions } from "@/lib/expenseSync";
import { generateSlug } from "@/lib/slug";
import { GroupTitle, PageTitle, SectionTitle } from "@/components/ui/Typography";
import { Page } from "@/components/ui/Page";
import { mobileRaisedSurfaceClass } from "@/components/ui/mobileRaisedSurface";
import { Breadcrumb, BreadcrumbCurrent, crumbLinkClass } from "@/components/ui/Breadcrumb";
import { OverflowAction, OverflowMenu } from "@/components/ui/OverflowMenu";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TabSettlement } from "@/components/TabSettlement";
import { ExpenseBalances } from "@/components/ExpenseBalances";
import { computeExpenseBalances, splitParticipants } from "@/lib/settlements";

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
    return (
      <Page width="wide">
        <p role="status" className="text-sm text-ink-soft">
          {claim.status === "claiming" ? "Joining tab…" : "Loading tab…"}
        </p>
      </Page>
    );
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
        setResult({
          status: "error",
          message: err instanceof Error ? err.message : "Couldn't claim this invite.",
        }),
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

  if (tab === undefined)
    return (
      <Page width="wide">
        <p role="status" className="text-sm text-ink-soft">
          Loading invite…
        </p>
      </Page>
    );
  if (tab === null) {
    return (
      <Page width="narrow" center className="text-center">
        <p className="text-ink-soft">This tab doesn&rsquo;t exist.</p>
      </Page>
    );
  }

  return (
    <Page width="narrow" center>
      <div
        className={`${mobileRaisedSurfaceClass} border border-rule/70 bg-surface/80 px-6 py-8 text-center sm:px-8`}
      >
        <span
          aria-hidden="true"
          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-forest/10 text-forest"
        >
          <Receipt className="h-6 w-6" strokeWidth={2.25} />
        </span>
        <PageTitle className="mt-5 text-2xl">You&rsquo;ve been invited to {tab.name}</PageTitle>
        <p className="mx-auto mt-3 max-w-sm text-sm text-ink-soft">
          Sign in to claim your spot. Your place in the tab, and everything in it, opens up once you
          do.
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
  const hasUpcoming = expenses?.some((expense) => isUpcoming(expense.date)) ?? false;
  if (!hasUpcoming && expenseView !== "paid") setExpenseView("paid");

  if (tab === undefined || expenses === undefined)
    return (
      <Page width="wide">
        <p role="status" className="text-sm text-ink-soft">
          Loading tab…
        </p>
      </Page>
    );
  if (tab === null) {
    return (
      <Page width="narrow" center className="text-center">
        <p className="text-ink-soft">This tab doesn&rsquo;t exist.</p>
      </Page>
    );
  }

  const summaryCards = (
    <div className={breakdown ? "grid gap-6 lg:grid-cols-2" : undefined}>
      <TabSettlement
        slug={slug}
        members={tab.members}
        isOwner={tab.isOwner}
        expenseView={hasUpcoming ? expenseView : "paid"}
      />
      {breakdown && (
        <TabBreakdown
          expenseView={expenseView}
          expenses={expenses}
          hasUpcoming={hasUpcoming}
          tabSlug={slug}
          currencies={breakdown.currencies}
          members={tab.members}
        />
      )}
    </div>
  );

  const tabContent = (
    <>
      {summaryCards}
      <div className="mt-7">
        <ExpenseList
          expenseView={expenseView}
          defaultCurrency={tab.defaultCurrency}
          slug={slug}
          isOwner={tab.isOwner}
          members={tab.members}
          expenses={expenses}
        />
      </div>
    </>
  );

  return (
    <Page width="wide">
      <Breadcrumb>
        <Link to="/tabs" className={crumbLinkClass}>
          Tabs
        </Link>
        <BreadcrumbCurrent>{tab.name}</BreadcrumbCurrent>
      </Breadcrumb>
      {claimError && (
        <p
          role="status"
          className="mb-6 rounded-md border border-rule bg-surface p-4 text-sm text-ink"
        >
          {claimError}
        </p>
      )}
      <header className="mb-7 grid gap-x-5 gap-y-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div className="min-w-0">
          <TabTitle slug={slug} name={tab.name} isOwner={tab.isOwner} />
        </div>
        {tab.isOwner && (
          <TabOwnerActions slug={slug} members={tab.members} expenseCount={expenses.length} />
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-soft md:col-start-1 md:row-start-2">
          <Roster slug={slug} isOwner={tab.isOwner} members={tab.members} />
          {tab.isOwner ? (
            <TabDefaultCurrency slug={slug} currency={tab.defaultCurrency} />
          ) : (
            <span className="inline-flex items-center gap-2">
              <Coins aria-hidden="true" className="h-3.5 w-3.5 text-brass" strokeWidth={2.25} />
              Tab currency · {tab.defaultCurrency}
            </span>
          )}
        </div>
      </header>
      {hasUpcoming ? (
        <ExpenseViewTabs value={expenseView} onChange={setExpenseView} label="Tab expense date">
          {tabContent}
        </ExpenseViewTabs>
      ) : (
        tabContent
      )}
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
      <form onSubmit={handleSubmit} className="flex max-w-sm flex-col items-stretch gap-2">
        <PageTitle className="sr-only">{name}</PageTitle>
        <Label htmlFor="tab-name-edit" className="mb-0">
          Tab name
        </Label>
        <Input
          id="tab-name-edit"
          autoFocus
          aria-label="Tab name"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleSubmit}
          className="font-display max-w-sm font-medium"
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
    <Field
      label="Currency"
      htmlFor="tab-default-currency"
      labelPosition="start"
      className="w-full sm:w-auto"
    >
      <CurrencyPicker
        id="tab-default-currency"
        value={currencyCode}
        onChange={(code) => setDefaultCurrency({ slug, currency: code })}
        className="min-w-0 flex-1 justify-between sm:w-70 sm:flex-none"
      />
    </Field>
  );
}

/**
 * The owner's action cluster. "Add expense" is the one action that earns a
 * button of its own; deleting the tab is rare and destructive, so it lives
 * behind the overflow menu (DESIGN.md § 6). The confirm dialog is a sibling
 * of the menu, not a child - a menu item unmounts when the menu closes, and
 * would take its dialog with it.
 */
function TabOwnerActions({
  slug,
  members,
  expenseCount,
}: {
  slug: string;
  members: { resolvedId: string; id: string; name: string; claimed: boolean }[];
  expenseCount: number;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex w-full items-center gap-2 md:w-auto">
      <ExpenseActions slug={slug} members={members} />
      <OverflowMenu label="More tab actions">
        <OverflowAction destructive onClick={() => setConfirming(true)}>
          <Trash2 />
          Delete tab
        </OverflowAction>
      </OverflowMenu>
      <DeleteTabDialog
        slug={slug}
        expenseCount={expenseCount}
        open={confirming}
        onOpenChange={setConfirming}
      />
    </div>
  );
}

function DeleteTabDialog({
  slug,
  expenseCount,
  open,
  onOpenChange,
}: {
  slug: string;
  expenseCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { deleteTab } = useTabActions();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete this tab?"
      description={
        expenseCount === 0
          ? "This permanently deletes the tab. This can’t be undone."
          : `This permanently deletes the tab and its ${expenseCount} ${expenseCount === 1 ? "expense" : "expenses"}. This can’t be undone.`
      }
      confirmLabel="Delete tab"
      pendingLabel="Deleting…"
      onConfirm={async () => {
        await deleteTab({ slug });
        void navigate({ to: "/tabs" });
      }}
    />
  );
}

function Roster({
  slug,
  isOwner,
  members,
}: {
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
    setEditingId(null);
    setAdding(false);
    setName("");
    setRemovingId(null);
    setError(null);
  }

  async function saveMember(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || pending) return;
    setPending(true);
    setError(null);
    try {
      if (editingId) await renameMember({ slug, memberId: editingId, name: name.trim() });
      else await addMember({ slug, name: name.trim() });
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the member.");
    } finally {
      setPending(false);
    }
  }

  async function handleRemove(memberId: string) {
    setPending(true);
    setError(null);
    try {
      await removeMember({ slug, memberId });
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove the member.");
    } finally {
      setPending(false);
    }
  }

  async function copyInvite(memberId: string, token: string) {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${BASE_PATH}/t/${slug}?token=${token}`,
      );
      setCopiedId(memberId);
      setTimeout(() => setCopiedId((id) => (id === memberId ? null : id)), 2000);
    } catch {
      setError("Couldn't copy the invite. Please try again.");
    }
  }

  const memberForm = (
    <form onSubmit={saveMember} className="mt-3 flex flex-wrap items-end gap-2">
      <div className="min-w-0 flex-1 basis-40">
        <Label htmlFor="member-name">Member name</Label>
        <Input
          id="member-name"
          autoFocus
          aria-label="Member name"
          placeholder="Name"
          value={name}
          disabled={pending}
          onChange={(event) => setName(event.target.value)}
          className="w-full"
        />
      </div>
      <Button type="submit" size="lg" disabled={pending || !name.trim()} aria-busy={pending}>
        {pending ? "Saving…" : adding ? "Add" : "Save"}
      </Button>
      <Button type="button" variant="outline" size="lg" disabled={pending} onClick={resetForm}>
        Cancel
      </Button>
    </form>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) {
          setOpen(next);
          resetForm();
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="link" size="touch" className="group gap-2.5 pl-0 hover:no-underline" />
        }
      >
        {members.length > 0 && (
          <span aria-hidden="true" className="flex -space-x-2">
            {members.slice(0, 5).map((member) => (
              <MemberAvatar
                key={member.id}
                id={member.id}
                name={member.name}
                className="ring-2 ring-paper"
              />
            ))}
            {members.length > 5 && (
              <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface text-xs font-semibold ring-2 ring-paper">
                +{members.length - 5}
              </span>
            )}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="group-hover:underline">
            Manage {members.length} {members.length === 1 ? "member" : "members"}
          </span>
          <Settings aria-hidden="true" className="h-4 w-4" />
        </span>
      </DialogTrigger>
      <DialogContent>
        <div className="flex items-start justify-between gap-3">
          <div>
            <DialogTitle>Members</DialogTitle>
            <DialogDescription className="mt-1">
              {members.length} {members.length === 1 ? "person" : "people"} in this tab
            </DialogDescription>
          </div>
          <DialogClose
            disabled={pending}
            aria-label="Close members"
            render={<Button variant="ghost" size="icon-touch" className="text-ink-soft" />}
          >
            <X className="h-5 w-5" />
          </DialogClose>
        </div>
        <ul className="mt-5 space-y-3">
          {members.map((member) => {
            const invite = inviteLinks.find((link) => link.memberId === member.id);
            return (
              <li key={member.id} className="rounded-lg border border-rule/70 p-3">
                {/* Name, badge and invite link share one column so the action
                group centres against the whole block, not just the name row. */}
                <div className="flex items-center gap-3">
                  <MemberAvatar id={member.id} name={member.name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 break-words text-sm font-medium">{member.name}</span>
                      {!member.claimed && <AnonymousBadge />}
                    </span>
                    {isOwner && !member.claimed && invite && (
                      <Button
                        type="button"
                        variant="link"
                        size="xs"
                        onClick={() => void copyInvite(member.id, invite.token)}
                        className="mt-2 h-auto px-0 text-xs no-underline hover:text-ink hover:no-underline"
                      >
                        {copiedId === member.id ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Link2 className="h-3.5 w-3.5" />
                        )}
                        {copiedId === member.id ? "Copied" : "Copy invite"}
                      </Button>
                    )}
                  </div>
                  {isOwner && (
                    <div className="flex shrink-0 items-center">
                      <Button
                        type="button"
                        variant="quiet-icon"
                        size="icon-touch"
                        disabled={pending}
                        aria-label={`Edit ${member.name}`}
                        onClick={() => {
                          resetForm();
                          setEditingId(member.id);
                          setName(member.name);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="destructive-icon"
                        size="icon-touch"
                        disabled={pending}
                        aria-label={`Remove ${member.name}`}
                        onClick={() => {
                          resetForm();
                          setRemovingId(member.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                {isOwner && editingId === member.id && memberForm}
                {isOwner && removingId === member.id && (
                  <div className="mt-3 text-sm">
                    <p>Remove {member.name} from this tab?</p>
                    <div className="mt-2 flex gap-3">
                      <Button
                        type="button"
                        variant="link"
                        size="xs"
                        disabled={pending}
                        onClick={() => void handleRemove(member.id)}
                        className="h-auto px-0 text-sm font-semibold text-margin-red-ink no-underline"
                      >
                        {pending ? "Removing…" : "Remove member"}
                      </Button>
                      <Button
                        type="button"
                        variant="link"
                        size="xs"
                        disabled={pending}
                        onClick={resetForm}
                        className="h-auto px-0 text-sm text-ink-soft no-underline"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {!members.length && <p className="mt-4 text-sm text-ink-soft">No members yet.</p>}
        {error && (
          <p role="alert" className="mt-3 text-sm text-margin-red-ink">
            {error}
          </p>
        )}
        {isOwner &&
          (adding ? (
            memberForm
          ) : (
            <Button
              type="button"
              size="touch"
              disabled={pending}
              onClick={() => {
                resetForm();
                setAdding(true);
              }}
              className="mt-6 w-full"
            >
              <Plus className="h-4 w-4" />
              Add member
            </Button>
          ))}
      </DialogContent>
    </Dialog>
  );
}

function ExpenseActions({
  slug,
  members,
}: {
  slug: string;
  members: { resolvedId: string; id: string; name: string; claimed: boolean }[];
}) {
  const navigate = useNavigate();
  function handleNewExpense() {
    const params = encodeDraftParams(members.map((m) => ({ id: m.resolvedId, name: m.name })));
    void navigate({
      to: "/e/$slug",
      params: { slug: generateSlug() },
      search: {
        ...(Object.fromEntries(params) as { count?: string; names?: string; ids?: string }),
        tab: slug,
      },
    });
  }
  return (
    <Button
      type="button"
      size="touch"
      onClick={handleNewExpense}
      className="min-w-0 flex-1 md:flex-none"
    >
      <Plus className="h-4 w-4" />
      Add expense
    </Button>
  );
}

// The expense row's own layout. Rows are self-describing - there is no header
// band naming columns - but the money still has to line up down the list.
// Reading order is date / name / who's in the split / amount and who paid it /
// your share, then the row's actions menu, which is a sibling of the row
// trigger rather than a child - a button can't nest inside a button (see
// DESIGN.md § 5, "Interactive rows").
//
// The money tracks size to their own content rather than to a fixed width, so
// a six-figure amount widens its track instead of spilling over the cell beside
// it; the values still line up because both are right-aligned and the track
// after them is fixed. The amount's cap is `fit-content()`, **not**
// `minmax(_,12rem)`: a track whose growth limit is a fixed length is maximized
// to that limit before a `1fr` track gets any space at all, so the cap became
// the width and the name column collapsed to 80px. `fit-content()` clamps the
// growth limit to the content instead.
//
// From `md` up the row is a genuine table column, and content-sized tracks
// (amount, settlement) only line up down the list if every row shares the
// SAME tracks - which independent per-row grids don't give you: a track sized
// to `fit-content()`/`max-content` sizes to *that row's own* content, so a
// short payer caption on one row and a long one on the next silently shift
// every column after it, even though nothing about that column changed. The
// list's own `<ul>` carries the real `grid-cols-[...]` template exactly once,
// and every row subgrids onto it (`grid-cols-subgrid`) instead of declaring
// its own columns - so track sizes are resolved once, over every row's
// content collectively, and every row's line positions are then identical by
// construction, not by coincidence.
//
// Two stages. Below `md` there is only room for name + amount on the first
// line, so the date and your share drop to a second one, and there's no room
// for who's in the split at all. From `md` up it's a single, subgridded line -
// date, name, who's in the split, amount and who paid it, your share, the
// menu.
//
// The avatars column's own *track* stays the same (`max-content`) at both
// desktop tiers; only what's rendered inside it changes at `lg` (see
// `ExpenseParticipants`) - a `hidden` variant contributes nothing to intrinsic
// sizing, so the track is simply as wide as whichever variant is actually
// showing. The amount column isn't so lucky: its `fit-content()` cap is
// smaller at `md` (`8rem`) than `lg` (`11rem`), because that cap is a *ceiling
// shared by every row* (subgrid), not a per-row one - one row with a long
// payer caption pushes the whole column up toward its cap regardless of what
// any other row needs, and at `md` that was enough on its own to push the
// name column back down to double digits even with avatars' own track staying
// modest. Shrinking the cap at `md` doesn't fix that row's own caption (it
// still truncates, same as always) - it just stops that one row from taxing
// every other row's name column for space nobody else needed.
//
// The column *gap* steps up at `lg` too (`gap-x-6`, not `gap-x-4`): `md`'s
// budget is already fully spoken for (~600px, see below), and both of these -
// the wider gap and the larger amount cap - were tried at `md` first and
// broke it, independently, before landing here. `lg` is the first tier with
// real slack to spend on either.
//
// The settlement track only exists when the viewer is in one of these splits,
// so a signed-out or non-participating reader doesn't get a column of
// "Not in split". The menu track only exists from `md` up: below it, the
// row's own trigger already opens the detail dialog, whose footer carries the
// same Edit/Delete for an owner - a second, cramped path to identical actions
// isn't worth a whole column on the narrowest layout, so the track is dropped
// rather than just visually hidden.
//
// Pick a breakpoint from the width budget, not its name. The content column
// is the viewport minus the 240px sidebar (from `lg`), the page gutter, the
// panel padding and the row's own - about 600px at `md` and still only ~615px
// at `lg` before the sidebar's own 240px is subtracted, which is why the
// wider gap waits for `lg`: it's the first tier that actually has slack once
// the sidebar's cost is accounted for.
function expenseListGridClass(withSettlement: boolean) {
  // Each branch spells out every full `md:`/`lg:` class as one literal string,
  // not built by gluing a breakpoint prefix onto a shared value (e.g.
  // `` `md:${cols}` ``) - Tailwind's scanner only picks up class names that
  // appear intact in the source, so splitting the prefix from the value across
  // a template-literal interpolation makes the whole rule silently vanish from
  // the build. No warning, no type error: the class just isn't there, and the
  // column collapses to one giant track.
  const list = withSettlement
    ? "divide-y divide-rule/70 md:grid md:gap-x-4 md:grid-cols-[4.75rem_minmax(0,1fr)_max-content_fit-content(8rem)_minmax(6.75rem,max-content)_2.75rem] lg:gap-x-6 lg:grid-cols-[4.75rem_minmax(0,1fr)_max-content_fit-content(11rem)_minmax(6.75rem,max-content)_2.75rem]"
    : "divide-y divide-rule/70 md:grid md:gap-x-4 md:grid-cols-[4.75rem_minmax(0,1fr)_max-content_fit-content(8rem)_2.75rem] lg:gap-x-6 lg:grid-cols-[4.75rem_minmax(0,1fr)_max-content_fit-content(11rem)_2.75rem]";
  return {
    list,
    // `gap-x-4` carries through from its base declaration (mobile and `md`)
    // until `lg:gap-x-6` overrides it - matching the same step-up the list
    // above takes, since a subgrid inherits the parent's gap only when it
    // doesn't declare its own for that axis, and this element always declares
    // one (it needs `gap-x-4` unconditionally for its own independent mobile
    // grid), so its own value has to move in lockstep with the list's or the
    // two silently mismatch.
    row: "grid grid-cols-[minmax(0,1fr)_fit-content(9.5rem)] items-center gap-x-4 gap-y-2 px-5 md:grid-cols-subgrid md:col-span-full lg:gap-x-6",
  };
}

/** One expense row's actions. A sibling of the row trigger, never a child. */
function ExpenseRowMenu({
  expenseSlug,
  name,
  onDelete,
}: {
  expenseSlug: string;
  name: string;
  onDelete: () => void;
}) {
  return (
    <OverflowMenu label={`Actions for ${name}`}>
      <OverflowAction render={<Link to="/e/$slug" params={{ slug: expenseSlug }} />}>
        <Pencil />
        Edit expense
      </OverflowAction>
      <OverflowAction destructive onClick={onDelete}>
        <Trash2 />
        Delete expense
      </OverflowAction>
    </OverflowMenu>
  );
}

/**
 * Who this expense's split is between - rendered from a list the caller has
 * already narrowed to people who actually owe or get money back on it (see
 * `splitParticipants` below), not raw `expense.people`: someone can be added
 * to an expense as a split candidate and end up with no items assigned to
 * them, in which case they aren't really "in" this split at all. Capped at
 * four avatars plus a "+N" badge so a large group tab can't blow out the row;
 * the cap is what keeps the column's `max-content` track bounded, not a fixed
 * width on the track itself.
 *
 * Two variants render side by side in the row (each toggled by its own
 * `hidden`/breakpoint classes, never both visible at once) because `md`'s
 * width budget only has room for the compact one:
 *
 * - `stacked` - overlapping circles (`-space-x-1.5`, a `ring-field` to cut
 *   each one out from its neighbour), the same idiom as the "Manage N
 *   members" trigger atop the tab page. Used at `md`, where there's row for
 *   *who* but not for spreading them out.
 * - `spaced` - the individual circles from the `lg` design, gap between them
 *   instead of overlap. Used from `lg`, where the wider column budget affords
 *   it and overlap would only be worth it if space were still tight.
 *
 * The ring colour tracks the ground it sits on, not the header's - `ring-field`
 * here, matching the list's own resting background, vs. the header stack's
 * `ring-paper`. Overflow shows as plain text either way, not `aria-hidden`:
 * unlike the header stack, there's no adjacent "N members" caption carrying
 * that count for a screen reader, so hiding it would just drop the number.
 */
function ExpenseParticipants({
  people,
  variant,
  className = "",
}: {
  people: { id: string; name: string }[];
  variant: "stacked" | "spaced";
  className?: string;
}) {
  if (!people.length) return null;
  const shown = people.slice(0, 4);
  const overflow = people.length - shown.length;
  const stacked = variant === "stacked";
  return (
    <span className={`${stacked ? "flex -space-x-1.5" : "flex items-center gap-1.5"} ${className}`}>
      {shown.map((person) => (
        <MemberAvatar
          key={person.id}
          id={person.id}
          name={person.name}
          size="sm"
          className={stacked ? "ring-2 ring-field" : undefined}
        />
      ))}
      {overflow > 0 &&
        (stacked ? (
          <span className="relative inline-flex h-6 w-6 items-center justify-center rounded-full bg-surface text-[10px] font-semibold ring-2 ring-field">
            +{overflow}
          </span>
        ) : (
          <span className="text-xs text-ink-soft">+{overflow}</span>
        ))}
    </span>
  );
}

/** An expense's date as "Mar 3", with the full date kept in `dateTime`. */
function ExpenseDate({ date }: { date: string | undefined }) {
  const short = formatExpenseDateShort(date);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <UpcomingExpenseIcon date={date} />
      {date && short ? <time dateTime={date}>{short}</time> : "No date"}
    </span>
  );
}

/** Who paid, phrased so it reads as a fact rather than a bare name. */
function payerCaption(payer: { name: string } | undefined, upcoming: boolean) {
  if (payer) return upcoming ? `${payer.name} pays` : `${payer.name} paid`;
  return upcoming ? "Not paid yet" : "Payer needed";
}

/**
 * The amount and who paid it, as one block - they answer the same question and
 * were being read apart when the payer had a column of its own. The plain
 * currency code came off this cell with the payer going on: the formatted
 * amount already carries its symbol, so "CAD" under "CA$100.00" only repeated
 * it. The conversion note stays, because that one does say something new.
 */
function ExpenseAmount({
  total,
  code,
  native,
  payer,
  upcoming,
}: {
  total: number;
  code: string;
  /** The original amount, when a saved exchange rate converted this expense. */
  native?: { amount: number; code: string };
  payer: { name: string } | undefined;
  upcoming: boolean;
}) {
  return (
    <>
      <span className="block font-numeric text-sm font-semibold">{currency(total, code)}</span>
      <span className="mt-0.5 block truncate text-xs text-ink-soft">
        {payerCaption(payer, upcoming)}
      </span>
      {native && (
        <span className="block text-xs text-ink-soft">
          {currency(native.amount, native.code)} · converted
        </span>
      )}
    </>
  );
}

/**
 * What this expense does to the signed-in member's balance, in the same
 * currency as the row's amount. Two absent cases, and they don't mean the same
 * thing: `null` is an expense with no payer, so it owes nobody anything yet;
 * `undefined` is a split the viewer simply isn't part of.
 */
function ViewerSettlement({
  balance,
  code,
  projected,
}: {
  balance: number | null | undefined;
  code: string;
  projected: boolean;
}) {
  if (balance === null) return <span className="text-xs text-ink-soft">Awaiting payer</span>;
  if (balance === undefined) return <span className="text-xs text-ink-soft">Not in split</span>;
  if (balance === 0)
    return <span className="text-sm text-ink">{projected ? "Not due" : "Settled"}</span>;
  const owed = balance < 0;
  return (
    <>
      <span
        className={`block font-numeric text-sm font-semibold ${owed ? "text-margin-red-ink" : "text-ledger-green"}`}
      >
        {owed ? "\u2212" : "+"}
        {currency(Math.abs(balance), code)}
      </span>
      <span className="block text-xs text-ink-soft">{owed ? "You owe" : "You get back"}</span>
    </>
  );
}

function ExpenseMetadata({ expense }: { expense: ReturnType<typeof useTabExpenses>[number] }) {
  const date = formatExpenseDate(expense.date);
  return (
    <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-soft">
      <span>
        <span className="mr-1 font-medium">Date</span>
        {date ? <time dateTime={expense.date}>{date}</time> : "Not set"}
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="font-medium">Created by</span>
        {expense.createdBy && (
          <MemberAvatar id={expense.createdBy.id} name={expense.createdBy.name} />
        )}
        <span>{expense.createdBy?.name ?? "Unknown creator"}</span>
      </span>
    </span>
  );
}

function ExpenseList({
  slug,
  defaultCurrency,
  isOwner,
  members,
  expenses,
  expenseView,
}: {
  expenseView: ExpenseView;
  defaultCurrency: string;
  slug: string;
  isOwner: boolean;
  members: { id: string; name: string; claimed: boolean; resolvedId: string }[];
  expenses: ReturnType<typeof useTabExpenses>;
}) {
  const { remove } = useExpenseActions();
  const viewer = useQuery(api.users.viewer);
  const [search, setSearch] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);
  const codes = [...new Set(expenses.map((e) => e.settlementCurrency))].sort();
  const hasUpcoming = expenses.some((expense) => isUpcoming(expense.date));
  const activeView = hasUpcoming ? expenseView : "all";
  const visibleExpenses = expenses.filter(
    (expense) =>
      activeView === "all" ||
      (activeView === "upcoming" ? isUpcoming(expense.date) : !isUpcoming(expense.date)),
  );
  const filtered = visibleExpenses.filter(
    (e) =>
      (currencyFilter === "all" || e.settlementCurrency === currencyFilter) &&
      (e.name ?? "Untitled expense").toLowerCase().includes(search.trim().toLowerCase()),
  );
  const selected = expenses.find((e) => e.slug === selectedSlug);
  const split = selected
    ? computeSplit(selected.people, selected.items, selected.globalAdjustments)
    : null;
  const payerFor = (payerId: string | undefined) =>
    members.find((member) => member.id === payerId || member.resolvedId === payerId);
  // An expense records a seat id, but a claimed member can be keyed by either
  // its seat or its account, so match on both before deciding the viewer isn't
  // in a split. The settlement column is only worth a track when at least one
  // expense here is actually the viewer's.
  const viewerMember = members.find((member) => member.resolvedId === viewer?._id);
  const viewerIds = new Set(viewerMember ? [viewerMember.id, viewerMember.resolvedId] : []);
  const showSettlement =
    viewerIds.size > 0 && expenses.some((e) => e.people.some((p) => viewerIds.has(p.id)));
  const { list: listGrid, row: rowGrid } = expenseListGridClass(showSettlement);
  const expenseRows = (
    <>
      <div className="overflow-hidden rounded-lg border border-edge bg-field">
        {!filtered.length ? (
          <p role="status" className="p-8 text-center text-sm text-ink-soft">
            {!expenses.length
              ? "No expenses yet. Add one to get started."
              : !visibleExpenses.length && activeView === "paid"
                ? "No paid expenses yet. Check Upcoming for planned expenses."
                : "No expenses match your filters."}
          </p>
        ) : (
          <ul className={listGrid}>
            {filtered.map((expense) => {
              const rowSplit = computeSplit(
                expense.people,
                expense.items,
                expense.globalAdjustments,
              );
              const rate = expense.exchangeRate?.rate ?? 1;
              const balances = computeExpenseBalances(expense.people, rowSplit, expense.payerId);
              const viewerBalance = !balances.length
                ? null
                : balances.find((row) => viewerIds.has(row.memberId))?.balance;
              const payer = payerFor(expense.payerId);
              const upcoming = isUpcoming(expense.date);
              const participants = splitParticipants(expense.people, balances);
              return (
                // The row itself is the grid/subgrid item now - not a wrapping div -
                // so `divide-y` on the list keeps drawing real borders between real
                // boxes exactly as it did before, and the hover/focus-overlay classes
                // that used to sit on that div work unchanged sitting here instead.
                <li
                  key={expense.slug}
                  className={`${rowGrid} relative py-4 transition-colors hover:bg-wash has-[button:focus-visible]:bg-wash`}
                >
                  {/* The trigger covers the row through its ::after overlay, so the
              whole row stays tappable while the actions menu sits above it. */}
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    onClick={() => {
                      setSelectedSlug(expense.slug);
                    }}
                    className="min-w-0 break-words text-left font-semibold after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-forest md:col-start-2"
                  >
                    {expense.name ?? "Untitled expense"}
                  </button>
                  {/* Not interactive, so it sits under the row-link overlay like any
                      other plain cell - no `z-10` needed. */}
                  <span className="hidden md:col-start-3 md:block md:justify-self-center">
                    <ExpenseParticipants
                      people={participants}
                      variant="stacked"
                      className="lg:hidden"
                    />
                    <ExpenseParticipants
                      people={participants}
                      variant="spaced"
                      className="hidden lg:flex"
                    />
                  </span>
                  <span className="min-w-0 text-right md:col-start-4">
                    <ExpenseAmount
                      total={rowSplit.grandTotal * rate}
                      code={expense.settlementCurrency}
                      native={
                        expense.exchangeRate
                          ? { amount: rowSplit.grandTotal, code: expense.currency }
                          : undefined
                      }
                      payer={payer}
                      upcoming={upcoming}
                    />
                  </span>
                  {/* One date element for both layouts: the second row below `md`,
                      its own leading column from `md` up. */}
                  <span className="col-start-1 text-xs text-ink-soft md:col-start-1 md:row-start-1 md:text-sm">
                    <ExpenseDate date={expense.date} />
                  </span>
                  {showSettlement && (
                    <span className="col-start-2 text-right md:col-start-5">
                      <ViewerSettlement
                        balance={
                          typeof viewerBalance === "number" ? viewerBalance * rate : viewerBalance
                        }
                        code={expense.settlementCurrency}
                        projected={upcoming}
                      />
                    </span>
                  )}
                  {/* Row-level Edit/Delete is redundant below `md`: the row's own
                      trigger already opens the detail dialog, whose footer carries
                      the same two actions for an owner. Hiding it here isn't losing
                      access, it's dropping a second path to the same place - and it
                      gives the name column back the width the menu track cost it. */}
                  <div
                    className={`z-10 hidden justify-end md:relative md:flex ${showSettlement ? "md:col-start-6" : "md:col-start-5"}`}
                  >
                    {isOwner && (
                      <ExpenseRowMenu
                        expenseSlug={expense.slug}
                        name={expense.name ?? "Untitled expense"}
                        onDelete={() => setDeletingSlug(expense.slug)}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {filtered.some((expense) => isUpcoming(expense.date)) && <UpcomingExpenseLegend />}
      <ConfirmDialog
        open={deletingSlug !== null}
        onOpenChange={(next) => {
          if (!next) setDeletingSlug(null);
        }}
        title="Delete this expense?"
        description={
          deletingSlug
            ? `“${expenses.find((e) => e.slug === deletingSlug)?.name ?? "Untitled expense"}” and its itemized split will be deleted permanently. This can’t be undone.`
            : null
        }
        confirmLabel="Delete expense"
        pendingLabel="Deleting…"
        onConfirm={async () => {
          if (!deletingSlug) return;
          await remove(deletingSlug);
          setSelectedSlug((current) => (current === deletingSlug ? null : current));
        }}
      />
    </>
  );
  return (
    <section
      aria-label="Expenses"
      className={`${mobileRaisedSurfaceClass} border border-rule/70 bg-surface/80 p-5 sm:p-6`}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SectionTitle className="mr-auto flex items-center gap-2">
          <Receipt aria-hidden="true" className="h-5 w-5 shrink-0 text-brass" strokeWidth={2.25} />
          Expenses <span className="text-sm font-normal text-ink-soft">{filtered.length}</span>
        </SectionTitle>
        {/* Below `sm` there isn't room for three controls on one line - the
            search box ends up too narrow to read what you typed. `order-last`
            plus a full width drops it onto its own row, leaving the title and
            the currency filter to share the first one. The DOM order stays
            search-then-filter so the wider layout, where a keyboard user is far
            likelier to be, keeps focus order matching what it shows. */}
        <SearchField
          aria-label="Search tab expenses"
          placeholder="Search expenses…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="order-last w-full sm:order-none sm:w-auto sm:max-w-sm sm:flex-1"
          showLabel={false}
        />
        <CurrencyFilter
          value={currencyFilter}
          onChange={setCurrencyFilter}
          codes={codes}
          label="Filter by currency"
        />
      </div>
      {expenseRows}
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(next) => {
          if (!next) setSelectedSlug(null);
        }}
      >
        {selected && split && (
          <DialogContent
            key={selected.slug}
            aria-label="Expense details"
            className="flex max-h-[calc(100dvh-5rem)] flex-col overflow-hidden p-0 sm:p-0"
          >
            <header className="shrink-0 border-b border-rule/70 bg-surface p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <DialogTitle>{selected.name ?? "Untitled expense"}</DialogTitle>
                <DialogClose
                  aria-label="Close expense details"
                  render={<Button variant="ghost" size="icon-touch" className="text-ink-soft" />}
                >
                  <X className="h-5 w-5" />
                </DialogClose>
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
              <p className="font-numeric text-2xl font-semibold">
                {currency(split.grandTotal, selected.currency)}
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                {selected.currency}
                {selected.mode === "itemized" && (
                  <>
                    {" "}
                    · {selected.items.length} {selected.items.length === 1 ? "item" : "items"}
                  </>
                )}
              </p>
              <ExpenseMetadata expense={selected} />
              <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                <span>{isUpcoming(selected.date) ? "Planned payer" : "Paid by"}:</span>
                {payerFor(selected.payerId) && (
                  <MemberAvatar
                    id={payerFor(selected.payerId)!.id}
                    name={payerFor(selected.payerId)!.name}
                  />
                )}
                <span className="text-ink">
                  {payerFor(selected.payerId)?.name ??
                    (isUpcoming(selected.date) ? "Not set" : "Payer needed")}
                </span>
              </p>
              <ExpenseBalances
                people={selected.people}
                split={split}
                payerId={selected.payerId}
                currency={selected.currency}
                projected={isUpcoming(selected.date)}
                unallocated={selected.items.some((item) => item.splitWith.length === 0)}
                headingLevel="h3"
              />
              {selected.note && (
                <section className="mt-5 border-t border-rule/70 pt-5">
                  <GroupTitle as="h4">Note</GroupTitle>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-ink-soft">
                    {selected.note}
                  </p>
                </section>
              )}
              {selected.image && (
                <section className="mt-5 border-t border-rule/70 pt-5">
                  <GroupTitle as="h4">Receipt</GroupTitle>
                  {selected.image.url ? (
                    <a
                      href={selected.image.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 flex items-center gap-3 rounded-lg border border-rule/70 p-3 text-sm text-forest transition hover:bg-wash focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                    >
                      {selected.image.type !== "application/pdf" ? (
                        <img
                          src={selected.image.url}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-md border border-rule/70 object-cover"
                        />
                      ) : (
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-paper">
                          <FileText className="h-5 w-5" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block break-words">{selected.image.name}</span>
                        <span className="mt-0.5 block text-xs text-ink-soft">
                          {selected.image.type === "application/pdf"
                            ? "PDF receipt"
                            : "Receipt image"}
                        </span>
                      </span>
                      <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" />
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : (
                    <p className="mt-2 text-sm text-ink-soft">
                      This receipt is no longer available.
                    </p>
                  )}
                </section>
              )}

              {selected.currency !== defaultCurrency && (
                <ExchangeRateForm
                  key={`${selected.slug}:${selected.currency}:${defaultCurrency}:${selected.exchangeRate?.rate ?? "none"}`}
                  tabSlug={slug}
                  expense={selected}
                  target={defaultCurrency}
                  canEdit={isOwner}
                />
              )}
              <GroupTitle as="h4" className="mt-6 border-t border-rule/70 pt-5">
                Split with
              </GroupTitle>
              <ul className="mt-3 space-y-3">
                {split.people.map((person) => (
                  <li key={person.personId} className="flex items-center gap-2 text-sm">
                    <MemberAvatar id={person.personId} name={person.name} />
                    <span className="min-w-0 flex-1 break-words">{person.name}</span>
                    <span className="font-numeric">
                      {currency(person.total, selected.currency)}
                    </span>
                  </li>
                ))}
              </ul>
              {selected.mode === "itemized" && (
                <details className="group mt-6 border-t border-rule/70 pt-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                    Items · {split.items.length}
                    <ChevronDown className="h-4 w-4 chevron-flip" />
                  </summary>
                  <ul className="mt-3 space-y-3">
                    {split.items.map((item) => (
                      <li key={item.itemId} className="flex justify-between gap-3 text-sm">
                        <span className="min-w-0 break-words">{item.itemName}</span>
                        <span className="font-numeric shrink-0">
                          {currency(item.total, selected.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
            <footer className="shrink-0 border-t border-rule/70 bg-surface px-5 py-4 sm:px-6">
              {isOwner && (
                <div className="grid w-full gap-3 sm:flex sm:justify-end">
                  <Button
                    variant="outline"
                    size="touch"
                    nativeButton={false}
                    className="w-full sm:w-auto"
                    render={<Link to="/e/$slug" params={{ slug: selected.slug }} />}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="touch"
                    className="w-full sm:w-auto"
                    onClick={() => setDeletingSlug(selected.slug)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              )}
              {!isOwner && (
                <DialogClose render={<Button variant="outline" size="touch" />}>Done</DialogClose>
              )}
            </footer>
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
}

function ExchangeRateForm({
  tabSlug,
  expense,
  target,
  canEdit,
}: {
  tabSlug: string;
  expense: ReturnType<typeof useTabExpenses>[number];
  target: string;
  canEdit: boolean;
}) {
  const { setExpenseExchangeRate } = useTabActions();
  const [value, setValue] = useState(expense.exchangeRate?.rate.toString() ?? "");
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rate = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(rate) && rate > 0;
  async function save(next: number | null) {
    setPending(true);
    setError(null);
    try {
      await setExpenseExchangeRate({
        slug: tabSlug,
        expenseSlug: expense.slug,
        from: expense.currency,
        to: target,
        rate: next,
      });
      setExpanded(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the exchange rate.");
    } finally {
      setPending(false);
    }
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) void save(rate);
      }}
      className="mt-5 rounded-lg border border-rule bg-paper p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <GroupTitle as="h4">
            {expense.exchangeRate
              ? currency(
                  computeSplit(expense.people, expense.items, expense.globalAdjustments)
                    .grandTotal * expense.exchangeRate.rate,
                  target,
                )
              : `Exchange to ${target}`}
          </GroupTitle>
          <p className="mt-1 text-xs text-ink-soft">
            {expense.exchangeRate
              ? `Included in ${target} totals · 1 ${expense.currency} = ${expense.exchangeRate.rate} ${target}`
              : `No rate added. This expense stays in ${expense.currency} totals.`}
          </p>
        </div>
        {canEdit && (
          <Button
            type="button"
            variant="link"
            size="xs"
            disabled={pending}
            aria-expanded={expanded}
            aria-controls="exchange-rate-fields"
            onClick={() => setExpanded(!expanded)}
            className="h-auto shrink-0 px-0 text-xs underline-offset-4"
          >
            {expanded ? "Cancel" : expense.exchangeRate ? "Change" : "Add rate"}
          </Button>
        )}
      </div>
      {canEdit && expanded && (
        <div id="exchange-rate-fields">
          {!expense.exchangeRate && (
            <p className="mt-3 text-xs text-ink-soft">
              Add a rate to include this expense in the tab’s {target} totals.
            </p>
          )}
          <div className="mt-3">
            <Label htmlFor="expense-exchange-rate">
              Exchange rate (1 {expense.currency} = {target})
            </Label>
            <Input
              id="expense-exchange-rate"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              required
              value={value}
              disabled={pending}
              onChange={(event) => setValue(event.target.value)}
              placeholder="e.g. 1.38"
              aria-describedby="exchange-preview"
              className="font-numeric"
            />
          </div>
          <p id="exchange-preview" aria-live="polite" className="mt-2 text-xs text-ink-soft">
            {valid
              ? `Converted total: ${currency(computeSplit(expense.people, expense.items, expense.globalAdjustments).grandTotal * rate, target)}`
              : "Enter a rate greater than zero."}
          </p>
          <div className="mt-3 flex gap-3">
            <Button type="submit" size="lg" disabled={!valid || pending} aria-busy={pending}>
              {pending ? "Saving…" : "Save rate"}
            </Button>
            {expense.exchangeRate && (
              <Button
                type="button"
                variant="destructive"
                size="lg"
                disabled={pending}
                onClick={() => void save(null)}
              >
                Remove rate
              </Button>
            )}
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-margin-red-ink">
          {error}
        </p>
      )}
    </form>
  );
}
