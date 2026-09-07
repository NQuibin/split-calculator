import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { Authenticated, useConvexAuth, useQuery } from "convex/react";
import { ChevronRight, Trash2, Users2, X } from "lucide-react";
import { AddToTabDialog } from "@/components/AddToTabDialog";
import { ExpenseSkeleton } from "@/components/ExpenseSkeleton";
import { StageExpense } from "@/components/StageExpense";
import { StageResults } from "@/components/StageResults";
import { api } from "../../convex/_generated/api";
import { DEFAULT_CURRENCY } from "@/lib/currencies";
import { useTab, useTabActions } from "@/lib/tabSync";
import { expenseReducer, type Action } from "@/lib/reducer";
import { draftFromParams, withTabPeople } from "@/lib/expenseDraft";
import { useExpenseActions, useStoredExpense, useUploadExpenseImage } from "@/lib/expenseSync";
import { type MemberMappingSuggestion } from "@/lib/tabMembers";
import type { ExpenseState } from "@/lib/types";

interface PendingTab {
  slug: string;
  name: string;
  mapping: MemberMappingSuggestion[];
}

function useHasHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

const route = getRouteApi("/e/$slug");

export function ExpensePage() {
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

  // If this expense was started from inside a tab (?tab={slug}), its
  // people were pre-filled from the tab's roster, so treat that tab as
  // already picked - same mechanism as picking one manually below.
  const tabSlug = search.tab ?? null;
  const tab = useTab(tabSlug ?? "");
  const { assignExpense } = useTabActions();
  const [pendingTab, setPendingTab] = useState<PendingTab | null>(null);
  const hasInitializedTabFromParam = useRef(false);
  const [cancelledTab, setCancelledTab] = useState(false);
  const tabDraft = !stored && tab && tabSlug && !cancelledTab ? tab : null;
  const state = baseState && tabDraft
    ? withTabPeople(baseState, tabDraft.members.map(member => ({ id: member.resolvedId, name: member.name })))
    : baseState;

  useEffect(() => {
    if (hasHydrated && !loading && state === null) void navigate({ to: "/", replace: true });
  }, [hasHydrated, loading, state, navigate]);


  useEffect(() => {
    if (!tabSlug || !tab || stored || hasInitializedTabFromParam.current) return;
    hasInitializedTabFromParam.current = true;
    setPendingTab({ slug: tabSlug, name: tab.name, mapping: tab.members.map(member => ({ personId: member.resolvedId, personName: member.name, memberId: member.id })) });
  }, [tabSlug, tab, stored]);

  // A brand-new expense's starting currency defaults to its destination
  // tab's default currency (only known once that tab loads), falling back
  // to the signed-in user's own default currency, then "USD". Applied once,
  // and only if the currency hasn't already been changed away from the
  // bootstrap default in the meantime.
  const viewer = useQuery(api.users.viewer);
  const hasAppliedDefaultCurrency = useRef(false);

  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (stored || hasAppliedDefaultCurrency.current) return;
    if (tabSlug && tab === undefined) return;
    if (viewer === undefined) return;
    hasAppliedDefaultCurrency.current = true;
    const resolved = (tabSlug ? tab?.defaultCurrency : undefined) ?? viewer?.defaultCurrency ?? DEFAULT_CURRENCY;
    const current = draftRef.current;
    if (resolved !== DEFAULT_CURRENCY && current && current.currency === DEFAULT_CURRENCY) {
      setDraft({ ...current, currency: resolved });
    }
  }, [stored, tabSlug, tab, viewer]);

  if (!hasHydrated || loading || !state || (tabSlug && tab === undefined)) return <ExpenseSkeleton />;

  function dispatch(action: Action) {
    if (!state) return;
    const next = expenseReducer(state, action);
    // Once an expense is persisted, every further change keeps auto-saving
    // immediately, as before - only the very first save is gated behind an
    // explicit "Split the expense"/"Add to tab" click (see handleFinalize).
    if (stored) save(slug, next);
    setDraft(next);
  }

  const destinedTab = state.tab ?? pendingTab ?? tabDraft;
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
      if (!stored) {
        await save(slug, finalState);
        if (pendingTab) {
          await assignExpense({
            tabSlug: pendingTab.slug,
            expenseSlug: slug,
            memberMapping: (tabDraft ? tabDraft.members.map(member => ({ personId: member.resolvedId, memberId: member.id, newMemberName: undefined })) : pendingTab.mapping).map(({ personId, memberId, newMemberName }) => ({
              personId,
              memberId,
              newMemberName,
            })),
          });
        }
      }
      void navigate({ to: "/t/$slug", params: { slug: destinedTab.slug } });
      return;
    }

    const next = expenseReducer(finalState, { type: "GO_TO_RESULTS" });
    await save(slug, next);
    setDraft(next);
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
      {state.tab ? (
        <button
          type="button"
          onClick={() => void navigate({ to: "/t/$slug", params: { slug: state.tab!.slug } })}
          className="flex items-center gap-1.5 rounded-full bg-rule/30 px-3 py-1.5 text-xs font-medium text-forest hover:bg-[#f3ead8]"
        >
          <Users2 className="h-3.5 w-3.5" strokeWidth={2.25} />
          Part of {state.tab.name}
        </button>
      ) : pendingTab ? (
        <div className="flex items-center gap-1.5 rounded-full bg-rule/30 px-3 py-1.5 text-xs font-medium text-ink-soft">
          <Users2 className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
          <button
            type="button"
            onClick={() => void navigate({ to: "/t/$slug", params: { slug: pendingTab.slug } })}
            className="hover:text-forest"
          >
            Will join {pendingTab.name} once saved
          </button>
          <button
            type="button"
            onClick={() => { setDraft(state); setPendingTab(null); setCancelledTab(true); }}
            aria-label="Cancel adding to this tab"
            className="text-ink-soft transition hover:text-margin-red"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        </div>
      ) : tabSlug && !cancelledTab ? null : (
        <Authenticated>
          <AddToTabDialog
            people={state.people}
            onConfirm={async (tab, mapping) => {
              if (stored) {
                await assignExpense({
                  tabSlug: tab.slug,
                  expenseSlug: slug,
                  memberMapping: mapping.map(({ personId, memberId, newMemberName }) => ({
                    personId,
                    memberId,
                    newMemberName,
                  })),
                });
              } else {
                setPendingTab({ slug: tab.slug, name: tab.name, mapping });
              }
            }}
          />
        </Authenticated>
      )}

      </div>

      {state.stage === "receipt" && (
        <StageExpense
          expenseName={state.name}
          description={stored ? "Edit the details of this expense. Changes save automatically." : "Add the details of your new expense."}
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
          onSetCurrency={(currency) => dispatch({ type: "SET_CURRENCY", currency })}
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
