"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Users2 } from "lucide-react";
import { ReceiptSkeleton } from "@/components/ReceiptSkeleton";
import { StageReceipt } from "@/components/StageReceipt";
import { StageResults } from "@/components/StageResults";
import { useGroup, useGroupActions } from "@/lib/groupSync";
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

  // If this receipt was started from inside a group (?group={slug}), attach
  // it to that group the moment it's first persisted. Its people were
  // pre-filled from the group's roster in the same order, so person `i`
  // maps to member `i`.
  const groupSlug = searchParams.get("group");
  const group = useGroup(groupSlug ?? "");
  const { assignReceipt } = useGroupActions();
  const hasAssigned = useRef(false);

  useEffect(() => {
    if (!groupSlug || !group || !stored || hasAssigned.current) return;
    hasAssigned.current = true;
    const memberMapping = stored.people
      .map((person, i) => ({ personId: person.id, memberId: group.members[i]?.id }))
      .filter((m): m is { personId: string; memberId: string } => m.memberId !== undefined);
    if (memberMapping.length > 0) void assignReceipt({ groupSlug, receiptSlug: slug, memberMapping });
  }, [groupSlug, group, stored, slug, assignReceipt]);

  if (!hasHydrated || loading || !state) return <ReceiptSkeleton />;

  function dispatch(action: Action) {
    if (!state) return;
    const next = receiptReducer(state, action);
    save(slug, next);
    // Keep mirroring `next` here (rather than nulling it out once the
    // receipt is persisted) so `state = stored ?? draft` never has a gap
    // between clearing the draft and the Convex query catching up with the
    // just-saved doc - that gap briefly made `state` null and bounced the
    // page home mid-edit. `stored` naturally takes over once it resolves.
    setDraft(next);
  }

  return (
    <main className="flex flex-1 flex-col">
      {state.group && (
        <button
          type="button"
          onClick={() => router.push(`/g/${state.group!.slug}`)}
          className="mx-auto mt-3 flex cursor-pointer items-center gap-1.5 text-xs font-medium text-ink-soft hover:text-forest"
        >
          <Users2 className="h-3.5 w-3.5" strokeWidth={2.25} />
          Part of {state.group.name}
        </button>
      )}

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
