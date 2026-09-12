import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useConvexAuth, useQuery } from "convex/react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/Dialog";
import { ExpenseTabField } from "@/components/ExpenseTabField";
import { StageExpense } from "@/components/StageExpense";
import { StageResults } from "@/components/StageResults";
import { api } from "../../convex/_generated/api";
import { DEFAULT_CURRENCY } from "@/lib/currencies";
import { useTab, useTabActions, useTabList } from "@/lib/tabSync";
import { expenseReducer, type Action } from "@/lib/reducer";
import { draftFromParams, withTabPeople } from "@/lib/expenseDraft";
import { useExpenseActions, useStoredExpense, useUploadExpenseImage, toExpenseStateArgs } from "@/lib/expenseSync";
import type { ExpenseState } from "@/lib/types";
import { Breadcrumb, BreadcrumbCurrent, crumbLinkClass } from "@/components/ui/Breadcrumb";
import { Page } from "@/components/ui/Page";

function useHasHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

const route = getRouteApi("/e/$slug");


export function ExpensePage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const viewer = useQuery(api.users.viewer);
  const navigate = useNavigate();
  const identity = isLoading || (isAuthenticated && !viewer) ? null : isAuthenticated ? viewer!._id : "guest";
  const [initialIdentity, setInitialIdentity] = useState(identity);
  if (initialIdentity === null && identity !== null) setInitialIdentity(identity);
  const changedIdentity = identity !== null && initialIdentity !== null && identity !== initialIdentity;
  useEffect(() => {
    if (changedIdentity) void navigate({ to: "/expenses", replace: true });
  }, [identity, changedIdentity, navigate]);
  const { slug } = route.useParams();
  if (identity === null || changedIdentity) return <Page><p role="status" className="text-sm text-ink-soft">Loading expense…</p></Page>;
  return <ExpenseEditor key={`${identity}:${slug}`} />;
}

function ExpenseEditor() {
  const navigate = useNavigate();
  const { slug } = route.useParams();
  const search = route.useSearch();

  const { isAuthenticated } = useConvexAuth();
  const { state: stored, loading } = useStoredExpense(slug);
  const { save, remove } = useExpenseActions();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const hasHydrated = useHasHydrated();
  const [isNavigating, startNavigation] = useTransition();

  // Nothing is persisted until the expense is explicitly finalized - "Save
  // expense", "Add to tab", "View split" or "Done". Editing works on this
  // in-memory copy throughout, seeded from the URL for a new expense and
  // from the saved expense once it loads. Rendering from the working copy
  // rather than from what's stored is what stops a keystroke's round trip
  // to the server from arriving late and overwriting the field it came from.
  const [draft, setDraft] = useState<ExpenseState | null>(() =>
    draftFromParams(new URLSearchParams(Object.entries(search).filter(([, v]) => v !== undefined) as [string, string][])),
  );
  const [seeded, setSeeded] = useState(false);
  if (!seeded && stored) {
    // Adjusting state during render, not in an effect: this has to happen
    // before the first paint of a saved expense, and it runs once because
    // `seeded` closes the door behind it.
    setSeeded(true);
    setDraft(stored);
  }
  const workingState = draft ?? stored;
  // The live roster can change while this expense has unsaved edits. Refresh
  // available people without selecting new members or replacing those edits.
  const baseState = workingState && stored?.tab
    ? { ...workingState, people: stored.people, anonymousPersonIds: stored.anonymousPersonIds }
    : workingState;

  const uploadImage = useUploadExpenseImage();
  const [pendingReceipt, setPendingReceipt] = useState<File | null>(null);

  const [selectedTabSlug, setSelectedTabSlug] = useState(isAuthenticated ? search.tab ?? "" : "");
  const tabSlug = isAuthenticated ? search.tab ?? selectedTabSlug : "";
  const tab = useTab(tabSlug);
  const tabs = useTabList().filter(tab => tab.isOwner);
  const { createExpense } = useTabActions();
  const tabDraft = isAuthenticated && !stored && tab?.isOwner ? tab : null;
  const state = baseState && tabDraft
    ? withTabPeople(baseState, tabDraft.members.map(member => ({ id: member.id, name: member.name })))
    : baseState && isAuthenticated && !stored ? withTabPeople(baseState, []) : baseState;

  useEffect(() => {
    if (hasHydrated && !loading && state === null) void navigate({ to: "/expenses", replace: true });
  }, [hasHydrated, loading, state, navigate]);

  // A brand-new expense's starting currency defaults to its destination
  // tab's default currency, falling back to the user's preference, then USD.
  // Follow tab changes until the user explicitly picks a currency.
  const viewer = useQuery(api.users.viewer);
  const hasEditedCurrency = useRef(false);

  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (stored || hasEditedCurrency.current) return;
    if (tabSlug && tab === undefined) return;
    if (viewer === undefined) return;
    const resolved = (tabSlug ? tab?.defaultCurrency : undefined) ?? viewer?.defaultCurrency ?? DEFAULT_CURRENCY;
    const current = draftRef.current;
    if (current && current.currency !== resolved) {
      setDraft({ ...current, currency: resolved });
    }
  }, [stored, tabSlug, tab, viewer]);

  if (!hasHydrated || loading || !state) return <Page><p role="status" className="text-sm text-ink-soft">Loading expense…</p></Page>;

  function dispatch(action: Action) {
    if (!state) return;
    setDraft(expenseReducer(state, action));
  }


  const destinedTab = state.tab ?? tabDraft;
  const anonymousPersonIds = state.anonymousPersonIds
    ?? tabDraft?.members.filter((member) => !member.claimed).map((member) => member.id)
    ?? [];

  // Compare only persisted data; switching editor/results is local UI state.
  const savedShape = (value: ExpenseState) => JSON.stringify(toExpenseStateArgs(value));
  const dirty = pendingReceipt !== null || (stored !== null && savedShape(state) !== savedShape(stored));

  function leave() {
    if (destinedTab) void navigate({ to: "/t/$slug", params: { slug: destinedTab.slug } });
    else void navigate({ to: "/expenses" });
  }

  // The file is only held here - uploading now would strand it in storage if
  // the expense is never saved. It goes up in handleFinalize.
  function handlePickReceipt(file: File | null) {
    setPendingReceipt(file);
    if (!file) dispatch({ type: "SET_IMAGE", image: null });
  }

  // A freshly picked file wins over whatever is already attached, since it is
  // what will replace it on save.
  const receipt = pendingReceipt
    ? { name: pendingReceipt.name, type: pendingReceipt.type }
    : state.image;

  async function handleFinalize() {
    if (!state) return;
    if (isAuthenticated && !stored && !tabDraft) throw new Error("Choose a tab before saving this expense.");

    // The one moment a draft's receipt becomes a real stored file. It goes up
    // before anything is saved, so a failed upload leaves the draft untouched
    // and the button can report it rather than silently dropping the receipt.
    let finalState = state;
    if (pendingReceipt) {
      finalState = expenseReducer(finalState, { type: "SET_IMAGE", image: await uploadImage(pendingReceipt) });
      setPendingReceipt(null);
      setDraft(finalState);
    }

    if (destinedTab) {
      if (!stored && tabDraft) {
        await createExpense({
          tabSlug: tabDraft.slug,
          expenseSlug: slug,
          state: toExpenseStateArgs(finalState),
          memberMapping: tabDraft.members.map(member => ({ personId: member.id, memberId: member.id })),
        });
      } else {
        await save(slug, finalState);
      }
      void navigate({ to: "/t/$slug", params: { slug: destinedTab.slug } });
      return;
    }

    const next = expenseReducer(finalState, { type: "GO_TO_RESULTS" });
    await save(slug, next);
    setDraft(next);
    void navigate({ to: "/e/$slug", params: { slug }, search: {}, replace: true });
  }

  return (
    <Page>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        {/* A new expense only gets a trail once it has somewhere to sit - an
            unsaved one outside a tab has nothing above it but "New Expense". */}
        <Breadcrumb className="mb-0">
          {!stored && !destinedTab ? <BreadcrumbCurrent>New Expense</BreadcrumbCurrent> : [
            <Link key="root" to={destinedTab ? "/tabs" : "/expenses"} className={crumbLinkClass}>{destinedTab ? "Tabs" : "Expenses"}</Link>,
            destinedTab ? <Link key="tab" to="/t/$slug" params={{ slug: destinedTab.slug }} className={crumbLinkClass}>{destinedTab.name}</Link> : null,
            // On the split, the expense name steps back to the editor.
            !stored ? <BreadcrumbCurrent key="new">New Expense</BreadcrumbCurrent>
              : state.stage === "results" ? <Button key="name" type="button" variant="link" size="xs" onClick={() => dispatch({ type: "BACK_TO_EXPENSE" })} className="h-auto px-0 font-normal text-ink-soft break-words whitespace-normal no-underline hover:text-forest">{state.name}</Button>
              : <BreadcrumbCurrent key="name">{state.name}</BreadcrumbCurrent>,
            stored && state.stage === "results" ? <BreadcrumbCurrent key="split">Split</BreadcrumbCurrent> : null,
          ].filter(Boolean)}
        </Breadcrumb>

      </div>

      {state.stage === "receipt" && (
        <StageExpense
          key={isAuthenticated && !stored ? `${tabDraft?.slug ?? "unselected"}:${state.people.map(person => person.id).join(",")}` : "saved-or-guest"}
          tabField={isAuthenticated ? <ExpenseTabField
            tabs={tabs}
            value={stored ? state.tab?.slug ?? "" : tabSlug}
            name={stored ? state.tab?.name : tabDraft?.name}
            loading={!!tabSlug && tab === undefined}
            locked={!!search.tab}
            saved={!!stored}
            onChange={slug => { setDraft(state); setSelectedTabSlug(slug); }}
          /> : undefined}
          showPeople={!isAuthenticated || !!stored || !!tabDraft}
          continueDisabled={isAuthenticated && !stored && !tabDraft}
          expenseName={state.name}
          description={stored ? "Edit the details of this expense. Nothing is saved until you're done." : isAuthenticated ? undefined : "Saved only in this browser. Guest expenses stay separate from your account."}
          headerAction={stored ? <Button type="button" variant="destructive" size="touch" onClick={() => setConfirmDelete(true)}><Trash2 className="h-4 w-4" />Delete</Button> : undefined}
          onCancel={() => (dirty ? setConfirmDiscard(true) : leave())}
          cancelLabel={stored ? "Close" : "Cancel"}
          onRenameExpense={(name) => dispatch({ type: "RENAME_EXPENSE", name })}
          people={state.people}
          viewerId={viewer?._id}
          anonymousPersonIds={anonymousPersonIds}
          inTab={!!destinedTab}
          mode={state.mode}
          items={state.items}
          globalAdjustments={state.globalAdjustments}
          date={state.date}
          currency={state.currency}
          note={state.note}
          onSetNote={(note) => dispatch({ type: "SET_NOTE", note })}
          receipt={receipt}
          onPickReceipt={handlePickReceipt}
          canUploadImage={isAuthenticated}
          onSetGlobalAdjustments={adjustments => dispatch({ type: "SET_GLOBAL_ADJUSTMENTS", adjustments })}
          onSetMode={(mode) => dispatch({ type: "SET_MODE", mode })}
          onSetDate={(date) => dispatch({ type: "SET_DATE", date })}
          onSetCurrency={(currency) => { hasEditedCurrency.current = true; dispatch({ type: "SET_CURRENCY", currency }); }}
          onAddItem={(item) => dispatch({ type: "ADD_ITEM", item })}
          onUpdateItem={(item) => dispatch({ type: "UPDATE_ITEM", item })}
          onRemoveItem={(id) => dispatch({ type: "REMOVE_ITEM", id })}
          onAddPerson={() => dispatch({ type: "ADD_PERSON" })}
          onRemovePerson={(id) => dispatch({ type: "REMOVE_PERSON", id })}
          onRenamePerson={(id, name) => dispatch({ type: "RENAME_PERSON", id, name })}
          continueLabel={stored ? (destinedTab ? "Save expense" : "View split") : "Save expense"}
          onContinue={handleFinalize}
        />
      )}

      {state.stage === "results" && (
        <StageResults
          people={state.people}
          items={state.items}
          globalAdjustments={state.globalAdjustments}
          currency={state.currency}
          note={state.note}
          image={state.image}
          isOwner
          shareSlug={slug}
          onReset={() => startNavigation(() => { void navigate({ to: "/" }); })}
          navigating={isNavigating}
        />
      )}

      <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <DialogContent aria-label="Discard changes">
          <DialogTitle>Discard your changes?</DialogTitle>
          <DialogDescription className="mt-2">
            This expense hasn&rsquo;t been saved since you started editing. Leaving now loses what
            you&rsquo;ve changed.
          </DialogDescription>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <DialogClose render={<Button variant="outline" size="touch" />}>
              Keep editing
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              size="touch"
              onClick={() => { setConfirmDiscard(false); leave(); }}
            >
              Discard changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent aria-label="Delete expense">
          <DialogTitle>Delete this expense?</DialogTitle>
          <DialogDescription className="mt-2">
            This permanently deletes the expense and its itemized split. This can&rsquo;t be undone.
          </DialogDescription>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <DialogClose render={<Button variant="outline" size="touch" />}>
              Cancel
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              size="touch"
              onClick={() => {
                remove(slug);
                if (state.tab) void navigate({ to: "/t/$slug", params: { slug: state.tab.slug } });
                else void navigate({ to: "/expenses" });
              }}
            >
              Delete expense
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
