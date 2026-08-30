"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useParams, useRouter } from "next/navigation";
import { StageReceipt } from "@/components/StageReceipt";
import { StageResults } from "@/components/StageResults";
import { receiptReducer, type Action } from "@/lib/reducer";
import { getReceiptServerSnapshot, getReceiptSnapshot, saveReceipt, subscribeReceipt } from "@/lib/storage";

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

  const subscribe = useCallback((callback: () => void) => subscribeReceipt(slug, callback), [slug]);
  const getSnapshot = useCallback(() => getReceiptSnapshot(slug), [slug]);
  const state = useSyncExternalStore(subscribe, getSnapshot, getReceiptServerSnapshot);
  const hasHydrated = useHasHydrated();

  useEffect(() => {
    if (hasHydrated && state === null) router.replace("/");
  }, [hasHydrated, state, router]);

  if (!hasHydrated || !state) return null;

  function dispatch(action: Action) {
    if (!state) return;
    saveReceipt(slug, receiptReducer(state, action));
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
          onBack={() => dispatch({ type: "BACK_TO_RECEIPT" })}
          onReset={() => router.push("/")}
        />
      )}
    </main>
  );
}
