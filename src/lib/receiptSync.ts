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
import type { ReceiptState } from "./types";

// When signed in, Convex is the source of truth (live queries); localStorage
// keeps being written to as a cache so the app still works offline/signed out.

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
      if (isAuthenticated) void saveMutation({ slug, state });
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
    if (receipts.length > 0) void importLocal({ receipts });
  }, [isAuthenticated, importLocal]);
}
