import { type FormEvent, useEffect, useRef, useState } from "react";
import { ExpenseViewTabs, type ExpenseView } from "@/components/ExpenseViewTabs";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { api } from "../../convex/_generated/api";
import { MemberAvatar } from "@/components/MemberAvatar";
import { UpcomingExpenseLegend } from "@/components/UpcomingExpenseIcon";
import { useConvexAuth, useQuery } from "convex/react";
import {
  ArrowLeft,
  Banknote,
  Check,
  X,
  Link2,
  Pencil,
  Plus,
  Receipt,
  Settings,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AnonymousBadge } from "@/components/ui/AnonymousBadge";
import { Field, FieldError, Input, Label } from "@/components/ui/Input";
import { SearchField } from "@/components/ui/SearchField";
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
import { isUpcoming, todayISODate } from "@/lib/format";
import { useTab, useTabActions, useTabInviteLinks, type useTabExpenses } from "@/lib/tabSync";
import { useExpenseActions } from "@/lib/expenseSync";
import { encodeDraftParams } from "@/lib/expenseDraft";
import { generateSlug } from "@/lib/slug";
import { GroupTitle, PageTitle, SectionTitle } from "@/components/ui/Typography";
import { Page, Panel } from "@/components/ui/Page";
import { Skeleton } from "@/components/ui/Skeleton";
import { mobileRaisedSurfaceClass } from "@/components/ui/mobileRaisedSurface";
import { Breadcrumb, BreadcrumbCurrent, crumbLinkClass } from "@/components/ui/Breadcrumb";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SettlementActions, TabSettlement } from "@/components/TabSettlement";
import { ExpenseDetailsDialog } from "@/components/ExpenseDetailsDialog";
import { TabExpenseRow } from "@/components/TabExpenseGrid";
import { expenseListGridClass } from "@/components/tabExpenseGridClass";
import { computeExpenseBalances } from "@/lib/settlements";

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
      <Page>
        <TabBreadcrumb />
        <TabHeaderSkeleton />
        <TabContentSkeleton label={claim.status === "claiming" ? "Joining tab…" : "Loading tab…"} />
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
      <Page>
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
        className={`${mobileRaisedSurfaceClass} border border-rule/70 bg-surface px-6 py-8 text-center sm:px-8`}
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

function TabBreadcrumb({ name }: { name?: string }) {
  if (!name)
    return (
      <Breadcrumb>
        <span aria-current="page" className="flex h-5 items-center">
          <span className="sr-only">Loading tab</span>
          <Skeleton className="h-5 w-40 rounded-md" />
        </span>
      </Breadcrumb>
    );

  return (
    <Breadcrumb>
      <Link to="/tabs" className={crumbLinkClass}>
        Tabs
      </Link>
      <BreadcrumbCurrent>{name}</BreadcrumbCurrent>
    </Breadcrumb>
  );
}

function TabHeaderSkeleton() {
  return (
    <header className="mb-7 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-3">
      <PageTitle className="sr-only">Tab</PageTitle>
      <div aria-hidden="true">
        <Skeleton className="h-9 w-48 rounded-md" />
      </div>
      <div aria-hidden="true" className="flex justify-end gap-2">
        <Skeleton className="size-11 rounded-lg" />
      </div>
      <div className="col-span-2 row-start-2 flex min-w-0 flex-col gap-3 md:flex-row md:items-center">
        <div aria-hidden="true" className="flex shrink-0 gap-2">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="size-8 rounded-full" />
        </div>
        <TabActionsSkeleton />
      </div>
    </header>
  );
}

function TabActionsSkeleton() {
  return (
    <div aria-hidden="true" className="min-w-0 flex-1 overflow-x-auto py-1">
      <div className="flex w-full min-w-max gap-2 md:w-max md:min-w-full md:justify-end">
        <Skeleton className="h-11 min-w-36 flex-1 rounded-lg md:w-36 md:flex-none" />
        <Skeleton className="h-11 min-w-40 flex-1 rounded-lg md:w-40 md:flex-none" />
      </div>
    </div>
  );
}

function TabContentSkeleton({ label = "Loading tab…" }: { label?: string }) {
  return (
    <div role="status" className="grid gap-6">
      <span className="sr-only">{label}</span>
      <Panel aria-hidden="true" className="card-inset space-y-5 py-6">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-5 w-28 rounded-md" />
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-16 rounded-md" />
          <Skeleton className="h-16 rounded-md" />
        </div>
        <Skeleton className="h-12 rounded-md" />
      </Panel>
      <section
        aria-hidden="true"
        className={`${mobileRaisedSurfaceClass} border border-rule/70 bg-surface card-inset py-6`}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <Skeleton className="h-5 w-28 rounded-md" />
          <Skeleton className="h-11 w-36 rounded-lg" />
        </div>
        <div className="bleed divide-y divide-rule border-y border-edge bg-field">
          {["first", "second", "third"].map((row) => (
            <div key={row} className="flex items-center justify-between gap-4 bleed-px py-5">
              <div className="space-y-2">
                <Skeleton className="h-4 w-40 max-w-full rounded-md" />
                <Skeleton className="h-3 w-24 rounded-md" />
              </div>
              <Skeleton className="h-4 w-24 rounded-md" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function TabView({ slug, claimError }: { slug: string; claimError?: string }) {
  const tab = useTab(slug);
  const expenses = useQuery(api.tabs.expensesForTab, { slug });
  const viewer = useQuery(api.users.viewer);
  const [day, setDay] = useState(todayISODate);
  const settlement = useQuery(api.settlements.get, tab ? { slug, asOfDate: day } : "skip");
  const [expenseView, setExpenseView] = useState<ExpenseView>("paid");
  const hasUpcoming = expenses?.some((expense) => isUpcoming(expense.date)) ?? false;
  const participatingMemberIds = expenses
    ? new Set(
        expenses.flatMap((expense) => [
          expense.payerId,
          ...expense.items.flatMap((item) => item.splitWith),
        ]),
      )
    : null;
  if (!hasUpcoming && expenseView !== "paid") setExpenseView("paid");

  useEffect(() => {
    const refresh = () => setDay(todayISODate());
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  if (tab === null) {
    return (
      <Page width="narrow" center className="text-center">
        <p className="text-ink-soft">This tab doesn&rsquo;t exist.</p>
      </Page>
    );
  }

  const breadcrumb = <TabBreadcrumb name={tab?.name} />;
  const claimNotice = claimError && (
    <p role="status" className="mb-6 rounded-md border border-rule bg-surface p-4 text-sm text-ink">
      {claimError}
    </p>
  );
  const header = tab ? (
    <header className="mb-7 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-3">
      <div className="min-w-0">
        <PageTitle className="sm:text-4xl">{tab.name}</PageTitle>
      </div>
      {expenses === undefined ? (
        <div aria-hidden="true" className="flex items-center gap-2">
          <Skeleton className="size-11 rounded-lg" />
        </div>
      ) : (
        <TabOwnerActions
          slug={slug}
          members={tab.members}
          participatingMemberIds={participatingMemberIds}
          defaultCurrency={tab.defaultCurrency}
          name={tab.name}
          expenseCount={expenses.length}
          isOwner={tab.isOwner}
          ownerName={tab.ownerName}
        />
      )}
      <div className="col-span-2 row-start-2 flex min-w-0 flex-col gap-3 md:flex-row md:items-center">
        <div className="shrink-0 text-sm text-ink-soft">
          <Roster
            slug={slug}
            members={tab.members}
            participatingMemberIds={participatingMemberIds}
          />
        </div>
        {expenses === undefined || settlement === undefined || viewer === undefined ? (
          <TabActionsSkeleton />
        ) : (
          <div className="min-w-0 flex-1 overflow-x-auto py-1">
            <div className="flex w-full min-w-max gap-2 md:w-max md:min-w-full md:justify-end">
              <ExpenseActions slug={slug} members={tab.members} className="flex-1 md:flex-none" />
              <SettlementActions
                slug={slug}
                members={tab.members}
                expenseView={hasUpcoming ? expenseView : "paid"}
                response={settlement}
              />
            </div>
          </div>
        )}
      </div>
    </header>
  ) : (
    <TabHeaderSkeleton />
  );

  if (
    tab === undefined ||
    expenses === undefined ||
    settlement === undefined ||
    viewer === undefined
  ) {
    return (
      <Page>
        {breadcrumb}
        {claimNotice}
        {header}
        <TabContentSkeleton />
      </Page>
    );
  }

  const tabContent = (
    <div className="grid gap-6">
      <TabSettlement
        slug={slug}
        members={tab.members}
        canManage
        defaultCurrency={tab.defaultCurrency}
        expenses={expenses}
        expenseView={hasUpcoming ? expenseView : "paid"}
        asOfDate={day}
        response={settlement}
      />
      <ExpenseList
        expenseView={expenseView}
        defaultCurrency={tab.defaultCurrency}
        slug={slug}
        canManage
        members={tab.members}
        expenses={expenses}
        viewerId={viewer?._id}
      />
    </div>
  );
  return (
    <Page>
      {breadcrumb}
      {claimNotice}
      {header}
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

/** Tab management lives beside the title; expense and payment actions share the member row. */
function TabOwnerActions({
  slug,
  members,
  participatingMemberIds,
  defaultCurrency,
  name,
  expenseCount,
  isOwner,
  ownerName,
}: {
  slug: string;
  members: { resolvedId: string; id: string; name: string; claimed: boolean }[];
  participatingMemberIds: Set<string> | null;
  defaultCurrency: string;
  name: string;
  expenseCount: number;
  isOwner: boolean;
  ownerName: string;
}) {
  return (
    <div className="flex w-auto items-center justify-end gap-2 md:justify-start">
      <TabSettingsDialog
        slug={slug}
        members={members}
        participatingMemberIds={participatingMemberIds}
        name={name}
        defaultCurrency={defaultCurrency}
        expenseCount={expenseCount}
        isOwner={isOwner}
        ownerName={ownerName}
      />
    </div>
  );
}

function TabSettingsDialog({
  slug,
  members,
  participatingMemberIds,
  name,
  defaultCurrency,
  expenseCount,
  isOwner,
  ownerName,
}: {
  slug: string;
  members: { resolvedId: string; id: string; name: string; claimed: boolean }[];
  participatingMemberIds: Set<string> | null;
  name: string;
  defaultCurrency: string;
  expenseCount: number;
  isOwner: boolean;
  ownerName: string;
}) {
  const [open, setOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftCurrency, setDraftCurrency] = useState(defaultCurrency);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { rename, setDefaultCurrency } = useTabActions();

  function reset() {
    setDraftName(name);
    setDraftCurrency(defaultCurrency);
    setError(null);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const trimmedName = draftName.trim();
    if (!trimmedName) {
      setError("Tab name is required.");
      return;
    }

    const changes = [
      ...(trimmedName === name ? [] : [rename({ slug, name: trimmedName })]),
      ...(draftCurrency === defaultCurrency
        ? []
        : [setDefaultCurrency({ slug, currency: draftCurrency })]),
    ];
    if (changes.length === 0) {
      setOpen(false);
      return;
    }

    setPending(true);
    setError(null);
    try {
      await Promise.all(changes);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save tab settings.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (pending) return;
          if (next) reset();
          setOpen(next);
        }}
      >
        <DialogTrigger
          render={
            <Button type="button" variant="menu-icon" size="icon-touch" aria-label="Tab settings" />
          }
        >
          <Settings aria-hidden="true" className="h-5 w-5" />
        </DialogTrigger>
        <DialogContent className="flex max-h-[calc(100dvh-5rem)] flex-col overflow-hidden p-0 sm:p-0">
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-rule/70 p-5 sm:p-6">
            <div>
              <DialogTitle>Tab settings</DialogTitle>
              <DialogDescription className="mt-1">Manage this tab.</DialogDescription>
            </div>
            <DialogClose
              aria-label="Close tab settings"
              render={<Button variant="ghost" size="icon-touch" className="text-ink-soft" />}
            >
              <X className="h-5 w-5" />
            </DialogClose>
          </header>
          <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
              <div className="space-y-4">
                <Field label="Tab name" htmlFor="tab-name-settings">
                  <Input
                    id="tab-name-settings"
                    value={draftName}
                    disabled={pending}
                    aria-busy={pending}
                    aria-describedby={error ? "tab-settings-error" : undefined}
                    aria-invalid={Boolean(error)}
                    onChange={(event) => {
                      setDraftName(event.target.value);
                      if (error) setError(null);
                    }}
                  />
                </Field>
                <div className="space-y-2">
                  <GroupTitle as="h3">Members</GroupTitle>
                  <RosterControl
                    members={members}
                    onClick={() => {
                      setOpen(false);
                      setMembersOpen(true);
                    }}
                  />
                </div>
                <Field
                  label="Tab currency"
                  htmlFor="tab-default-currency"
                  icon={Banknote}
                  className="w-full"
                >
                  <CurrencyPicker
                    id="tab-default-currency"
                    value={draftCurrency}
                    aria-label="Tab currency"
                    onChange={setDraftCurrency}
                    className="min-w-0 w-full justify-between"
                  />
                </Field>
                {error && <FieldError id="tab-settings-error">{error}</FieldError>}
              </div>
              <section className="mt-6 border-t border-rule pt-5">
                <h3 className="font-display text-lg font-semibold">Delete tab</h3>
                <p className="mt-1 text-sm text-ink-soft">
                  This permanently deletes the tab
                  {expenseCount > 0 &&
                    ` and its ${expenseCount} ${expenseCount === 1 ? "expense" : "expenses"}`}
                  .
                </p>
                {!isOwner && (
                  <p className="mt-2 text-sm text-ink-soft">
                    Only {ownerName} can delete this tab.
                  </p>
                )}
                <Button
                  type="button"
                  variant="destructive"
                  size="touch"
                  className="mt-4 w-full sm:w-auto"
                  disabled={!isOwner}
                  onClick={() => setConfirming(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete tab
                </Button>
              </section>
            </div>
            <footer className="shrink-0 border-t border-rule/70 p-5 sm:p-6">
              <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                <DialogClose
                  disabled={pending}
                  render={<Button type="button" variant="secondary" size="touch" />}
                >
                  Cancel
                </DialogClose>
                <Button type="submit" size="touch" disabled={pending} aria-busy={pending}>
                  {pending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </footer>
          </form>
        </DialogContent>
      </Dialog>
      <Roster
        slug={slug}
        members={members}
        participatingMemberIds={participatingMemberIds}
        open={membersOpen}
        onOpenChange={setMembersOpen}
        onBack={() => {
          setMembersOpen(false);
          setOpen(true);
        }}
      />
      <DeleteTabDialog slug={slug} name={name} open={confirming} onOpenChange={setConfirming} />
    </>
  );
}

function DeleteTabDialog({
  slug,
  name,
  open,
  onOpenChange,
}: {
  slug: string;
  name: string;
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
        <>
          You are deleting <strong className="font-semibold text-ink">{name}</strong>, this can’t be
          undone.
        </>
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

type RosterMember = { id: string; name: string; claimed: boolean; resolvedId: string };

function RosterControl({ members, onClick }: { members: RosterMember[]; onClick?: () => void }) {
  return (
    <Button
      type="button"
      variant="link"
      size="touch"
      className="group gap-2.5 pl-0 hover:no-underline active:no-underline"
      onClick={onClick}
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
      <span className="group-hover:underline group-active:underline">Manage</span>
    </Button>
  );
}

function Roster({
  slug,
  members,
  participatingMemberIds,
  open: controlledOpen,
  onOpenChange,
  onBack,
}: {
  slug: string;
  members: RosterMember[];
  participatingMemberIds: Set<string> | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onBack?: () => void;
}) {
  const { addMember, renameMember, removeMember } = useTabActions();
  const inviteLinks = useTabInviteLinks(slug, true);
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
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
    await removeMember({ slug, memberId });
    resetForm();
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
    <form
      onSubmit={saveMember}
      className={adding ? "space-y-5" : "mt-3 flex flex-wrap items-end gap-2"}
    >
      <div className={adding ? "min-w-0" : "min-w-0 flex-1 basis-40"}>
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
      <div className={adding ? "flex justify-end gap-3" : "contents"}>
        {adding && (
          <Button
            type="button"
            variant="secondary"
            size="touch"
            disabled={pending}
            onClick={resetForm}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          size={adding ? "touch" : "lg"}
          disabled={pending || !name.trim()}
          aria-busy={pending}
        >
          {pending ? "Saving…" : adding ? "Add" : "Save"}
        </Button>
        {!adding && (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            disabled={pending}
            onClick={resetForm}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!pending) {
            (onOpenChange ?? setLocalOpen)(next);
            resetForm();
          }
        }}
      >
        {controlledOpen === undefined && (
          <DialogTrigger render={<RosterControl members={members} />} />
        )}
        <DialogContent className="flex max-h-[calc(100dvh-5rem)] flex-col overflow-hidden p-0 sm:p-0">
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-rule/70 p-5 sm:p-6">
            <div className="flex min-w-0 items-start gap-2">
              {onBack && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-touch"
                  aria-label="Back to tab settings"
                  disabled={pending}
                  onClick={() => {
                    resetForm();
                    onBack();
                  }}
                  className="shrink-0 text-ink-soft"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              )}
              <div>
                <DialogTitle>Members</DialogTitle>
                <DialogDescription className="mt-1">
                  {members.length} {members.length === 1 ? "person" : "people"} in this tab
                </DialogDescription>
              </div>
            </div>
            <DialogClose
              disabled={pending}
              aria-label="Close members"
              render={<Button variant="ghost" size="icon-touch" className="text-ink-soft" />}
            >
              <X className="h-5 w-5" />
            </DialogClose>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto py-5 sm:py-6">
            <ul className="divide-y divide-rule border-y border-edge bg-field">
              {members.map((member) => {
                const invite = inviteLinks.find((link) => link.memberId === member.id);
                return (
                  <li key={member.id} className="px-5 py-3 sm:px-6">
                    {/* Name, badge and invite link share one column so the action
                group centres against the whole block, not just the name row. */}
                    <div className="flex items-center gap-3">
                      <MemberAvatar id={member.id} name={member.name} size="lg" />
                      <div className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="min-w-0 break-words text-sm font-medium">
                            {member.name}
                          </span>
                          {!member.claimed && <AnonymousBadge />}
                        </span>
                        {!member.claimed && invite && (
                          <Button
                            type="button"
                            variant="link"
                            size="xs"
                            onClick={() => void copyInvite(member.id, invite.token)}
                            className="mt-2 h-auto px-0 text-xs no-underline hover:text-ink hover:no-underline active:text-ink active:no-underline"
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
                      <div className="flex shrink-0 items-center">
                        {!member.claimed && (
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
                        )}
                        <Button
                          type="button"
                          variant="destructive-icon"
                          size="icon-touch"
                          disabled={
                            pending ||
                            !participatingMemberIds ||
                            participatingMemberIds.has(member.id)
                          }
                          aria-label={`Remove ${member.name}`}
                          aria-describedby={
                            participatingMemberIds?.has(member.id)
                              ? "member-removal-note"
                              : undefined
                          }
                          onClick={() => {
                            resetForm();
                            setRemovingId(member.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {editingId === member.id && memberForm}
                  </li>
                );
              })}
            </ul>
            {members.some((member) => participatingMemberIds?.has(member.id)) && (
              <p id="member-removal-note" className="mt-4 px-5 text-xs text-ink-soft sm:px-6">
                Remove expenses involving a member before removing them from the tab.
              </p>
            )}
            {!members.length && (
              <p className="px-5 text-sm text-ink-soft sm:px-6">No members yet.</p>
            )}
            {error && !adding && (
              <p role="alert" className="mt-3 px-5 text-sm text-margin-red-ink sm:px-6">
                {error}
              </p>
            )}
          </div>
          <footer className="shrink-0 border-t border-rule/70 p-5 sm:p-6">
            <Button
              type="button"
              size="touch"
              disabled={pending}
              onClick={() => {
                resetForm();
                setAdding(true);
              }}
              className="w-full"
            >
              <Plus className="h-4 w-4" />
              Add member
            </Button>
          </footer>
        </DialogContent>
      </Dialog>
      <Dialog
        open={adding}
        onOpenChange={(next) => {
          if (!next && !pending) resetForm();
        }}
      >
        <DialogContent>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon-touch"
                aria-label="Back to members"
                disabled={pending}
                onClick={resetForm}
                className="shrink-0 text-ink-soft"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <DialogTitle>Add member</DialogTitle>
            </div>
            <DialogClose
              disabled={pending}
              aria-label="Close add member"
              render={<Button variant="ghost" size="icon-touch" className="text-ink-soft" />}
            >
              <X className="h-5 w-5" />
            </DialogClose>
          </div>
          <DialogDescription className="mt-1">Add someone to this tab.</DialogDescription>
          <div className="mt-5">{adding && memberForm}</div>
          {error && (
            <p role="alert" className="mt-3 text-sm text-margin-red-ink">
              {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={removingId !== null}
        onOpenChange={(next) => {
          if (!next) setRemovingId(null);
        }}
        title="Remove this member?"
        description={
          <>
            You are removing{" "}
            <strong className="font-semibold text-ink">
              {members.find((member) => member.id === removingId)?.name}
            </strong>{" "}
            from this tab, this can’t be undone.
          </>
        }
        confirmLabel="Remove member"
        pendingLabel="Removing…"
        onConfirm={() => handleRemove(removingId!)}
      />
    </>
  );
}

function ExpenseActions({
  slug,
  members,
  className,
}: {
  slug: string;
  members: { resolvedId: string; id: string; name: string; claimed: boolean }[];
  className?: string;
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
      className={`${className ?? ""} min-w-0`}
      onClick={handleNewExpense}
    >
      <Plus className="h-4 w-4" />
      Add expense
    </Button>
  );
}

// The expense row's own layout. On larger screens, a header row names the
// columns while the money still has to line up down the list.
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
// Two stages. Below `md`, the row uses three areas: date at left, expense and
// payer-plus-total details in the middle, with spend and balance at right.
// From `md` up it is a single, subgridded line - date, name, payer, total,
// balance, menu; a shared expense paid by the viewer stacks reimbursement and
// share within that balance cell.
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
function ExpenseList({
  slug,
  defaultCurrency,
  canManage,
  members,
  expenses,
  expenseView,
  viewerId,
}: {
  expenseView: ExpenseView;
  defaultCurrency: string;
  slug: string;
  canManage: boolean;
  members: { id: string; name: string; claimed: boolean; resolvedId: string }[];
  expenses: ReturnType<typeof useTabExpenses>;
  viewerId: string | undefined;
}) {
  const { remove } = useExpenseActions();
  const [search, setSearch] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);
  const hasUpcoming = expenses.some((expense) => isUpcoming(expense.date));
  const activeView = hasUpcoming ? expenseView : "all";
  const visibleExpenses = expenses.filter(
    (expense) =>
      activeView === "all" ||
      (activeView === "upcoming" ? isUpcoming(expense.date) : !isUpcoming(expense.date)),
  );
  const filtered = visibleExpenses.filter((e) =>
    (e.name ?? "Untitled expense").toLowerCase().includes(search.trim().toLowerCase()),
  );
  const selected = expenses.find((e) => e.slug === selectedSlug);
  const payerFor = (payerId: string | undefined) =>
    members.find((member) => member.id === payerId || member.resolvedId === payerId);
  // An expense records a seat id, but a claimed member can be keyed by either
  // its seat or its account, so match on both before deciding the viewer isn't
  // in a split. The settlement column is only worth a track when at least one
  // expense here is actually the viewer's.
  const viewerMember = members.find((member) => member.resolvedId === viewerId);
  const viewerIds = new Set(viewerMember ? [viewerMember.id, viewerMember.resolvedId] : []);
  const showSettlement =
    viewerIds.size > 0 && expenses.some((e) => e.people.some((p) => viewerIds.has(p.id)));
  const { list: listGrid } = expenseListGridClass(showSettlement);
  const expenseRows = (
    <>
      {/* A row list with no header or footer is still a table body (DESIGN.md
          "Data tables"): the field ground between two `--edge` rules, open at
          the sides. */}
      <div className="bleed overflow-hidden border-y border-edge bg-field">
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
              const viewerParticipates =
                Boolean(expense.payerId && viewerIds.has(expense.payerId)) ||
                expense.items.some((item) => item.splitWith.some((id) => viewerIds.has(id)));
              const viewerBalance = !balances.length
                ? null
                : viewerParticipates
                  ? balances.find((row) => viewerIds.has(row.memberId))?.balance
                  : undefined;
              const convertedViewerBalance =
                typeof viewerBalance === "number" ? viewerBalance * rate : viewerBalance;
              const payer = payerFor(expense.payerId);
              const upcoming = isUpcoming(expense.date);
              return (
                <TabExpenseRow
                  key={expense.slug}
                  name={expense.name ?? "Untitled expense"}
                  date={expense.date}
                  total={rowSplit.grandTotal * rate}
                  code={expense.settlementCurrency}
                  payer={payer}
                  upcoming={upcoming}
                  memberContext={
                    showSettlement
                      ? {
                          balance: convertedViewerBalance,
                          viewerPerspective: true,
                        }
                      : undefined
                  }
                  onExpenseClick={() => {
                    setSelectedSlug(expense.slug);
                  }}
                />
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
          deletingSlug ? (
            <>
              You are deleting{" "}
              <strong className="font-semibold text-ink">
                {expenses.find((e) => e.slug === deletingSlug)?.name ?? "Untitled expense"}
              </strong>
              , this can’t be undone.
            </>
          ) : null
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
      className={`@container ${mobileRaisedSurfaceClass} border border-rule/70 bg-surface card-inset`}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SectionTitle className="mr-auto flex items-center gap-2">
          <Receipt aria-hidden="true" className="h-5 w-5 shrink-0 text-brass" strokeWidth={2.25} />
          Expenses <span className="text-sm font-normal text-ink-soft">{filtered.length}</span>
        </SectionTitle>
        <SearchField
          aria-label="Search tab expenses"
          placeholder="Search expenses…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-auto sm:max-w-sm sm:flex-1"
          showLabel={false}
        />
      </div>
      {expenseRows}
      <ExpenseDetailsDialog
        open={Boolean(selected)}
        onOpenChange={(next) => {
          if (!next) setSelectedSlug(null);
        }}
        expense={selected}
        slug={slug}
        defaultCurrency={defaultCurrency}
        canManage={canManage}
        members={members}
        onDelete={(expenseSlug) => setDeletingSlug(expenseSlug)}
      />
    </section>
  );
}
