"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Authenticated, useQuery } from "convex/react";
import { Users2, X } from "lucide-react";
import { AddToTabDialog } from "@/components/AddToTabDialog";
import { ExpenseSkeleton } from "@/components/ExpenseSkeleton";
import { StageExpense } from "@/components/StageExpense";
import { StageResults } from "@/components/StageResults";
import { api } from "../../../../convex/_generated/api";
import { DEFAULT_CURRENCY } from "@/lib/currencies";
import { useTab, useTabActions } from "@/lib/tabSync";
import { expenseReducer, type Action } from "@/lib/reducer";
import { draftFromParams } from "@/lib/expenseDraft";
import { useExpenseActions, useStoredExpense } from "@/lib/expenseSync";
import { suggestMemberMapping, type MemberMappingSuggestion } from "@/lib/tabMembers";
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

export function ExpensePageClient() {
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();

  const { state: stored, loading } = useStoredExpense(slug);
  const { save } = useExpenseActions();
  const hasHydrated = useHasHydrated();
  const [isNavigating, startNavigation] = useTransition();

  // A brand-new expense isn't persisted (to Convex or localStorage) until
  // it's explicitly finalized - by "Split the expense" or "Add to tab"
  // below. Until then this draft (from the URL) is the only copy of its
  // state, held only in memory.
  const [draft, setDraft] = useState<ExpenseState | null>(() => draftFromParams(searchParams));
  const state = stored ?? draft;

  useEffect(() => {
    if (hasHydrated && !loading && state === null) router.replace("/");
  }, [hasHydrated, loading, state, router]);

  // If this expense was started from inside a tab (?tab={slug}), its
  // people were pre-filled from the tab's roster, so treat that tab as
  // already picked - same mechanism as picking one manually below.
  const tabSlug = searchParams.get("tab");
  const tab = useTab(tabSlug ?? "");
  const { assignExpense, addExpensePerson } = useTabActions();
  const [pendingTab, setPendingTab] = useState<PendingTab | null>(null);
  const hasInitializedTabFromParam = useRef(false);

  useEffect(() => {
    if (!tabSlug || !tab || stored || hasInitializedTabFromParam.current) return;
    hasInitializedTabFromParam.current = true;
    setPendingTab({ slug: tabSlug, name: tab.name, mapping: suggestMemberMapping(state?.people ?? [], tab.members) });
  }, [tabSlug, tab, stored, state?.people]);

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

  const destinedTab = state.tab ?? pendingTab;

  function handleFinalize() {
    if (!state) return;

    if (destinedTab) {
      if (!stored) {
        save(slug, state);
        if (pendingTab) {
          void assignExpense({
            tabSlug: pendingTab.slug,
            expenseSlug: slug,
            memberMapping: pendingTab.mapping.map(({ personId, memberId, newMemberName }) => ({
              personId,
              memberId,
              newMemberName,
            })),
          });
        }
      }
      router.push(`/t/${destinedTab.slug}`);
      return;
    }

    const next = expenseReducer(state, { type: "GO_TO_RESULTS" });
    save(slug, next);
    setDraft(next);
  }

  return (
    <main className="flex flex-1 flex-col">
      {state.tab ? (
        <button
          type="button"
          onClick={() => router.push(`/t/${state.tab!.slug}`)}
          className="mx-auto mt-3 flex cursor-pointer items-center gap-1.5 text-xs font-medium text-ink-soft hover:text-forest"
        >
          <Users2 className="h-3.5 w-3.5" strokeWidth={2.25} />
          Part of {state.tab.name}
        </button>
      ) : pendingTab ? (
        <div className="mx-auto mt-3 flex items-center gap-1.5 text-xs font-medium text-ink-soft">
          <Users2 className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
          <button
            type="button"
            onClick={() => router.push(`/t/${pendingTab.slug}`)}
            className="cursor-pointer hover:text-forest"
          >
            Will join {pendingTab.name} once saved
          </button>
          <button
            type="button"
            onClick={() => setPendingTab(null)}
            aria-label="Cancel adding to this tab"
            className="cursor-pointer text-ink-soft transition hover:text-margin-red"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        </div>
      ) : tabSlug ? null : (
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

      {state.stage === "receipt" && (
        <StageExpense
          expenseName={state.name}
          onRenameExpense={(name) => dispatch({ type: "RENAME_EXPENSE", name })}
          people={state.people}
          anonymousPersonIds={state.anonymousPersonIds}
          inTab={!!state.tab}
          availableTabMembers={state.availableTabMembers}
          onAddTabMember={(params) => addExpensePerson({ expenseSlug: slug, ...params })}
          mode={state.mode}
          items={state.items}
          date={state.date}
          currency={state.currency}
          contributions={state.contributions}
          onSetMode={(mode) => dispatch({ type: "SET_MODE", mode })}
          onSetDate={(date) => dispatch({ type: "SET_DATE", date })}
          onSetCurrency={(currency) => dispatch({ type: "SET_CURRENCY", currency })}
          onAddItem={(item) => dispatch({ type: "ADD_ITEM", item })}
          onUpdateItem={(item) => dispatch({ type: "UPDATE_ITEM", item })}
          onRemoveItem={(id) => dispatch({ type: "REMOVE_ITEM", id })}
          onReorderItems={(items) => dispatch({ type: "REORDER_ITEMS", items })}
          onSetContribution={(personId, amount) => dispatch({ type: "SET_CONTRIBUTION", personId, amount })}
          onAddPerson={() => dispatch({ type: "ADD_PERSON" })}
          onRenamePerson={(id, name) => dispatch({ type: "RENAME_PERSON", id, name })}
          continueLabel={destinedTab ? "Add to tab" : "Split the expense"}
          onContinue={handleFinalize}
        />
      )}

      {state.stage === "results" && (
        <StageResults
          people={state.people}
          items={state.items}
          contributions={state.contributions}
          currency={state.currency}
          isOwner
          shareSlug={slug}
          onBack={() => dispatch({ type: "BACK_TO_EXPENSE" })}
          onReset={() => startNavigation(() => router.push("/"))}
          navigating={isNavigating}
        />
      )}
    </main>
  );
}
