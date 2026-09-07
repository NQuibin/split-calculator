import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useConvexAuth, useQuery } from "convex/react";
import { ChevronRight, Trash2 } from "lucide-react";
import { ExpenseTabField } from "@/components/ExpenseTabField";
import { ExpenseSkeleton } from "@/components/ExpenseSkeleton";
import { StageExpense } from "@/components/StageExpense";
import { StageResults } from "@/components/StageResults";
import { api } from "../../convex/_generated/api";
import { DEFAULT_CURRENCY } from "@/lib/currencies";
import { useTab, useTabActions, useTabList } from "@/lib/tabSync";
import { expenseReducer, type Action } from "@/lib/reducer";
import { draftFromParams, withTabPeople } from "@/lib/expenseDraft";
import { useExpenseActions, useStoredExpense, useUploadExpenseImage, toExpenseStateArgs } from "@/lib/expenseSync";
import type { ExpenseState } from "@/lib/types";

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
  if (identity === null || changedIdentity) return <ExpenseSkeleton />;
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
  const hasHydrated = useHasHydrated();
  const [isNavigating, startNavigation] = useTransition();

  // A brand-new expense isn't persisted (to Convex or localStorage) until
  // it's explicitly finalized - by "Split the expense" or "Add to tab"
  // below. Until then this draft (from the URL) is the only copy of its
  // state, held only in memory.
  const [draft, setDraft] = useState<ExpenseState | null>(() =>
    draftFromParams(new URLSearchParams(Object.entries(search).filter(([, v]) => v !== undefined) as [string, string][])),
  );
  const baseState = stored ?? draft;

  const uploadImage = useUploadExpenseImage();
  const [pendingReceipt, setPendingReceipt] = useState<File | null>(null);

  const [selectedTabSlug, setSelectedTabSlug] = useState(isAuthenticated ? search.tab ?? "" : "");
  const tabSlug = isAuthenticated ? search.tab ?? selectedTabSlug : "";
  const tab = useTab(tabSlug);
  const tabs = useTabList().filter(tab => tab.isOwner);
  const { createExpense } = useTabActions();
  const tabDraft = isAuthenticated && !stored && tab?.isOwner ? tab : null;
  const state = baseState && tabDraft
    ? withTabPeople(baseState, tabDraft.members.map(member => ({ id: member.resolvedId, name: member.name })))
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

  if (!hasHydrated || loading || !state) return <ExpenseSkeleton />;

  function dispatch(action: Action) {
    if (!state) return;
    const next = expenseReducer(state, action);
    // Once an expense is persisted, every further change keeps auto-saving
    // immediately, as before - only the very first save is gated behind an
    // explicit "Split the expense"/"Add to tab" click (see handleFinalize).
    if (stored) save(slug, next);
    setDraft(next);
  }

  const destinedTab = state.tab ?? tabDraft;
  const anonymousPersonIds = state.anonymousPersonIds
    ?? tabDraft?.members.filter((member) => !member.claimed).map((member) => member.resolvedId)
    ?? [];

  // A saved expense uploads a picked receipt right away, since every edit is
  // already being persisted. A draft just holds the file - uploading it now
  // would strand it in storage if the expense is never saved.
  async function handlePickReceipt(file: File | null) {
    if (!file) {
      setPendingReceipt(null);
      if (stored && state) await save(slug, expenseReducer(state, { type: "SET_IMAGE", image: null }));
      return;
    }
    if (stored) {
      const image = await uploadImage(file);
      if (state) await save(slug, expenseReducer(state, { type: "SET_IMAGE", image }));
    } else {
      setPendingReceipt(file);
    }
  }

  const receipt =
    state.image ?? (pendingReceipt ? { name: pendingReceipt.name, type: pendingReceipt.type } : undefined);

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
          memberMapping: tabDraft.members.map(member => ({ personId: member.resolvedId, memberId: member.id })),
        });
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
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-8 md:px-10 md:py-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-ink-soft">
          {!stored ? <span aria-current="page">New Expense</span> : <>
            <Link to={state.tab ? "/tabs" : "/expenses"} className="hover:text-forest hover:underline">{state.tab ? "Tabs" : "Expenses"}</Link>
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
            {state.tab && <><Link to="/t/$slug" params={{ slug: state.tab.slug }} className="hover:text-forest hover:underline">{state.tab.name}</Link><ChevronRight aria-hidden="true" className="h-4 w-4" /></>}
            {/* On the split, the expense name steps back to the editor - it replaces the old "Edit the expense" link. */}
            {state.stage === "results" ? <>
              <button type="button" onClick={() => dispatch({ type: "BACK_TO_EXPENSE" })} className="break-words hover:text-forest hover:underline">{state.name}</button>
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
              <span aria-current="page" className="font-medium text-ink">Split</span>
            </> : <span aria-current="page" className="font-medium text-ink break-words">{state.name}</span>}
          </>}
        </nav>

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
          description={stored ? "Edit the details of this expense. Changes save automatically." : isAuthenticated ? "Add the details of your new expense." : "Saved only in this browser. Guest expenses stay separate from your account."}
          headerAction={stored ? <div className="flex flex-wrap items-center gap-2">
            {confirmDelete && <button type="button" onClick={() => setConfirmDelete(false)} className="text-sm text-ink-soft">Cancel</button>}
            <button type="button" onClick={() => {
              if (!confirmDelete) { setConfirmDelete(true); return; }
              remove(slug);
              if (state.tab) void navigate({ to: "/t/$slug", params: { slug: state.tab.slug } });
              else void navigate({ to: "/expenses" });
            }} className="inline-flex items-center gap-2 rounded-lg border border-margin-red/50 px-4 py-2.5 text-sm font-medium text-margin-red hover:bg-margin-red/5"><Trash2 className="h-4 w-4" />{confirmDelete ? "Confirm delete" : "Delete expense"}</button>
          </div> : undefined}
          onCancel={() => {
            if (destinedTab) void navigate({ to: "/t/$slug", params: { slug: destinedTab.slug } });
            else void navigate({ to: "/expenses" });
          }}
          cancelLabel={stored ? "Close" : "Cancel"}
          onRenameExpense={(name) => dispatch({ type: "RENAME_EXPENSE", name })}
          people={state.people}
          viewerId={viewer?._id}
          anonymousPersonIds={anonymousPersonIds}
          inTab={!!destinedTab}
          mode={state.mode}
          items={state.items}
          date={state.date}
          currency={state.currency}
          contributions={state.contributions}
          note={state.note}
          onSetNote={(note) => dispatch({ type: "SET_NOTE", note })}
          receipt={receipt}
          onPickReceipt={handlePickReceipt}
          canUploadImage={isAuthenticated}
          onSetMode={(mode) => dispatch({ type: "SET_MODE", mode })}
          onSetDate={(date) => dispatch({ type: "SET_DATE", date })}
          onSetCurrency={(currency) => { hasEditedCurrency.current = true; dispatch({ type: "SET_CURRENCY", currency }); }}
          onAddItem={(item) => dispatch({ type: "ADD_ITEM", item })}
          onUpdateItem={(item) => dispatch({ type: "UPDATE_ITEM", item })}
          onRemoveItem={(id) => dispatch({ type: "REMOVE_ITEM", id })}
          onReorderItems={(items) => dispatch({ type: "REORDER_ITEMS", items })}
          onSetContribution={(personId, amount) => dispatch({ type: "SET_CONTRIBUTION", personId, amount })}
          onAddPerson={() => dispatch({ type: "ADD_PERSON" })}
          onRemovePerson={(id) => dispatch({ type: "REMOVE_PERSON", id })}
          onRenamePerson={(id, name) => dispatch({ type: "RENAME_PERSON", id, name })}
          continueLabel={stored ? (destinedTab ? "Done" : "View split") : "Save expense"}
          onContinue={handleFinalize}
        />
      )}

      {state.stage === "results" && (
        <StageResults
          people={state.people}
          items={state.items}
          contributions={state.contributions}
          currency={state.currency}
          note={state.note}
          image={state.image}
          isOwner
          shareSlug={slug}
          onReset={() => startNavigation(() => { void navigate({ to: "/" }); })}
          navigating={isNavigating}
        />
      )}
    </main>
  );
}
