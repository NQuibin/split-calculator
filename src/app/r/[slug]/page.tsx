"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { StageReceipt } from "@/components/StageReceipt";
import { StageResults } from "@/components/StageResults";
import { receiptReducer, type Action } from "@/lib/reducer";
import { draftFromParams } from "@/lib/receiptDraft";
import { getReceiptServerSnapshot, getReceiptSnapshot, saveReceipt, subscribeReceipt } from "@/lib/storage";
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

  const subscribe = useCallback((callback: () => void) => subscribeReceipt(slug, callback), [slug]);
  const getSnapshot = useCallback(() => getReceiptSnapshot(slug), [slug]);
  const stored = useSyncExternalStore(subscribe, getSnapshot, getReceiptServerSnapshot);
  const hasHydrated = useHasHydrated();

  // A brand-new receipt has no items yet, so it isn't persisted to localStorage
  // until the first item is added. Until then this draft (from the URL) is
  // the only copy of its state.
  const [draft, setDraft] = useState<ReceiptState | null>(() => draftFromParams(searchParams));
  const state = stored ?? draft;

  useEffect(() => {
    if (hasHydrated && state === null) router.replace("/");
  }, [hasHydrated, state, router]);

  if (!hasHydrated || !state) return null;

  function dispatch(action: Action) {
    if (!state) return;
    const next = receiptReducer(state, action);
    saveReceipt(slug, next);
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
          onSetTax={(rate) => dispatch({ type: "SET_TAX", rate })}
          onSetTip={(rate) => dispatch({ type: "SET_TIP", rate })}
          onAddItem={(item) => dispatch({ type: "ADD_ITEM", item })}
          onUpdateItem={(item) => dispatch({ type: "UPDATE_ITEM", item })}
          onRemoveItem={(id) => dispatch({ type: "REMOVE_ITEM", id })}
          onReorderItems={(items) => dispatch({ type: "REORDER_ITEMS", items })}
          onBack={() => router.push("/")}
          onContinue={() => dispatch({ type: "GO_TO_RESULTS" })}
        />
      )}

      {state.stage === "results" && (
        <StageResults
          people={state.people}
          items={state.items}
          tax={state.tax}
          tip={state.tip}
          isOwner
          shareSlug={slug}
          onBack={() => dispatch({ type: "BACK_TO_RECEIPT" })}
          onReset={() => router.push("/")}
        />
      )}
    </main>
  );
}
