"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { StageReceipt } from "@/components/StageReceipt";
import { StageResults } from "@/components/StageResults";
import { receiptReducer, type Action } from "@/lib/reducer";
import { draftFromParams } from "@/lib/receiptDraft";
import { useReceiptActions, useStoredReceipt } from "@/lib/receiptSync";
import type { ReceiptState } from "@/lib/types";

function useHasHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export default function ReceiptPage() {
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();

  const { state: stored, loading } = useStoredReceipt(slug);
  const { save } = useReceiptActions();
  const hasHydrated = useHasHydrated();
  const [isNavigating, startNavigation] = useTransition();

  // A brand-new receipt has no items yet, so it isn't persisted until the
  // first item is added. Until then this draft (from the URL) is the only
  // copy of its state.
  const [draft, setDraft] = useState<ReceiptState | null>(() => draftFromParams(searchParams));
  const state = stored ?? draft;

  useEffect(() => {
    if (hasHydrated && !loading && state === null) router.replace("/");
  }, [hasHydrated, loading, state, router]);

  if (!hasHydrated || loading || !state) return null;

  function dispatch(action: Action) {
    if (!state) return;
    const next = receiptReducer(state, action);
    save(slug, next);
    setDraft(next.items.length === 0 ? next : null);
  }

  return (
    <main className="flex flex-1 flex-col">
      {state.stage === "receipt" && (
        <StageReceipt
          people={state.people}
          items={state.items}
          tax={state.tax}
          tip={state.tip}
          date={state.date}
          contributions={state.contributions}
          onSetTax={(rate) => dispatch({ type: "SET_TAX", rate })}
          onSetTip={(rate) => dispatch({ type: "SET_TIP", rate })}
          onSetDate={(date) => dispatch({ type: "SET_DATE", date })}
          onAddItem={(item) => dispatch({ type: "ADD_ITEM", item })}
          onUpdateItem={(item) => dispatch({ type: "UPDATE_ITEM", item })}
          onRemoveItem={(id) => dispatch({ type: "REMOVE_ITEM", id })}
          onReorderItems={(items) => dispatch({ type: "REORDER_ITEMS", items })}
          onSetContribution={(personId, amount) => dispatch({ type: "SET_CONTRIBUTION", personId, amount })}
          onBack={() => startNavigation(() => router.push("/"))}
          onContinue={() => dispatch({ type: "GO_TO_RESULTS" })}
          navigating={isNavigating}
        />
      )}

      {state.stage === "results" && (
        <StageResults
          people={state.people}
          items={state.items}
          tax={state.tax}
          tip={state.tip}
          contributions={state.contributions}
          isOwner
          shareSlug={slug}
          onBack={() => dispatch({ type: "BACK_TO_RECEIPT" })}
          onReset={() => startNavigation(() => router.push("/"))}
          navigating={isNavigating}
        />
      )}
    </main>
  );
}
