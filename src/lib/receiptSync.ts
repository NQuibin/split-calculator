"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  deleteReceipt,
  getReceiptListServerSnapshot,
  getReceiptListSnapshot,
  getReceiptServerSnapshot,
  getReceiptSnapshot,
  saveReceipt,
  subscribeReceipt,
  subscribeReceiptList,
  type StoredReceipt,
} from "./storage";
import type { Contribution, Person, RateSetting, ReceiptItem, ReceiptState } from "./types";

// When signed in, Convex is the source of truth (live queries); localStorage
// keeps being written to as a cache so the app still works offline/signed out.

interface ReceiptStateArgs {
  stage: ReceiptState["stage"];
  name?: string;
  people: Person[];
  namePeople: boolean;
  items: ReceiptItem[];
  tax: RateSetting;
  tip: RateSetting;
  date: string;
  contributions: Contribution[];
}

// `state` may carry fields the current receiptState validator doesn't accept:
// top-level extras merged in from a `receipts.get` result (`updatedAt`,
// `tabId`, `tab`), or - for receipts saved by an older version of the
// app - stale per-item fields like a legacy `taxRate` rate setting that
// predates today's `taxed`/`tipped` booleans. Rebuild exactly the shape the
// validator expects, at every nested level, before sending to Convex.
function toReceiptStateArgs(state: ReceiptState): ReceiptStateArgs {
  const rate = ({ mode, value }: RateSetting): RateSetting => ({ mode, value });
  return {
    stage: state.stage,
    name: state.name,
    namePeople: state.namePeople,
    date: state.date,
    people: state.people.map(({ id, name }) => ({ id, name })),
    items: state.items.map(({ id, name, cost, discount, taxed, tipped, splitWith }) => ({
      id,
      name,
      cost,
      discount: rate(discount),
      taxed,
      tipped,
      splitWith,
    })),
    tax: rate(state.tax),
    tip: rate(state.tip),
    contributions: state.contributions.map(({ personId, amount }) => ({ personId, amount: rate(amount) })),
  };
}

export function useReceiptList(): StoredReceipt[] {
  const { isAuthenticated } = useConvexAuth();
  const localList = useSyncExternalStore(
    subscribeReceiptList,
    getReceiptListSnapshot,
    getReceiptListServerSnapshot,
  );
  const remoteList = useQuery(api.receipts.list, isAuthenticated ? {} : "skip");
  return isAuthenticated && remoteList ? remoteList : localList;
}

export function useStoredReceipt(slug: string): { state: ReceiptState | null; loading: boolean } {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const subscribe = useCallback((callback: () => void) => subscribeReceipt(slug, callback), [slug]);
  const localState = useSyncExternalStore(subscribe, () => getReceiptSnapshot(slug), getReceiptServerSnapshot);
  const remoteState = useQuery(api.receipts.get, isAuthenticated ? { slug } : "skip");

  if (authLoading) return { state: null, loading: true };
  if (isAuthenticated) return { state: remoteState ?? null, loading: remoteState === undefined };
  return { state: localState, loading: false };
}

export function useReceiptActions(): {
  save: (slug: string, state: ReceiptState) => void;
  remove: (slug: string) => void;
} {
  const { isAuthenticated } = useConvexAuth();
  const saveMutation = useMutation(api.receipts.save);
  const removeMutation = useMutation(api.receipts.remove);

  const save = useCallback(
    (slug: string, state: ReceiptState) => {
      saveReceipt(slug, state);
      if (isAuthenticated) void saveMutation({ slug, state: toReceiptStateArgs(state) });
    },
    [isAuthenticated, saveMutation],
  );

  const remove = useCallback(
    (slug: string) => {
      deleteReceipt(slug);
      if (isAuthenticated) void removeMutation({ slug });
    },
    [isAuthenticated, removeMutation],
  );

  return { save, remove };
}

/** Uploads guest-created localStorage receipts to Convex the moment the user signs in. */
export function useSyncLocalReceiptsOnLogin(): void {
  const { isAuthenticated } = useConvexAuth();
  const importLocal = useMutation(api.receipts.importLocal);
  const hasSynced = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || hasSynced.current) return;
    hasSynced.current = true;
    const receipts = getReceiptListSnapshot();
    if (receipts.length === 0) return;
    void importLocal({
      receipts: receipts.map(({ slug, state }) => ({ slug, state: toReceiptStateArgs(state) })),
    });
  }, [isAuthenticated, importLocal]);
}
