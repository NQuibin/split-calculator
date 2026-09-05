"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { isAcceptedImageType, MAX_IMAGE_BYTES } from "../../convex/imageFormats";
import { DEFAULT_CURRENCY } from "./currencies";
import {
  deleteExpense,
  getExpenseListServerSnapshot,
  getExpenseListSnapshot,
  getExpenseServerSnapshot,
  getExpenseSnapshot,
  saveExpense,
  subscribeExpense,
  subscribeExpenseList,
  type StoredExpense,
} from "./storage";
import type {
  Contribution,
  Person,
  RateSetting,
  ExpenseImage,
  ExpenseItem,
  ExpenseState,
  ExpenseMode,
} from "./types";

// When signed in, Convex is the source of truth (live queries); localStorage
// keeps being written to as a cache so the app still works offline/signed out.

interface ExpenseStateArgs {
  stage: ExpenseState["stage"];
  name: string;
  people: Person[];
  namePeople: boolean;
  mode: ExpenseMode;
  items: ExpenseItem[];
  date: string;
  contributions: Contribution[];
  currency: string;
  note?: string;
  image?: { storageId: Id<"_storage">; name: string; type: string };
}

// `state` may carry fields the current expenseState validator doesn't accept:
// top-level extras merged in from an `expenses.get` result (`updatedAt`,
// `tabId`, `tab`), or - for expenses saved by an older version of the
// app - stale fields like a legacy expense-level `tax`/`tip` rate that
// predates today's per-item `tax`/`tip`. Rebuild exactly the shape the
// validator expects, at every nested level, before sending to Convex.
function toExpenseStateArgs(state: ExpenseState): ExpenseStateArgs {
  const rate = ({ mode, value }: RateSetting): RateSetting => ({ mode, value });
  return {
    stage: state.stage,
    name: state.name,
    namePeople: state.namePeople,
    mode: state.mode ?? "itemized",
    date: state.date,
    people: state.people.map(({ id, name }) => ({ id, name })),
    items: state.items.map(({ id, name, cost, discount, tax, tip, splitWith }) => ({
      id,
      name,
      cost,
      discount: rate(discount),
      tax: rate(tax),
      tip: rate(tip),
      splitWith,
    })),
    contributions: state.contributions.map(({ personId, amount }) => ({ personId, amount: rate(amount) })),
    currency: state.currency ?? DEFAULT_CURRENCY,
    ...noteArg(state.note),
    ...imageArg(state.image),
  };
}

/** Throws a message fit to show the user if a picked file can't be a receipt. */
export function assertUploadableImage(file: File): void {
  if (!isAcceptedImageType(file.type)) {
    throw new Error("Upload a JPG, PNG, WebP, GIF, HEIC or PDF.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("That file is over 5MB - try a smaller one.");
  }
}

/**
 * Uploads a receipt file straight to Convex storage and returns the reference
 * to attach to an expense. The file itself never passes through a mutation -
 * mutation arguments are far too small for a 5MB photo - so the flow is:
 * mint a one-shot upload URL, POST to it, then save the returned storage id
 * as part of the expense's state.
 */
export function useUploadExpenseImage(): (file: File) => Promise<ExpenseImage> {
  const generateUploadUrl = useMutation(api.expenses.generateUploadUrl);

  return useCallback(
    async (file: File) => {
      // Also checked when the file is first picked, but a deferred upload
      // runs this much later - at save time - so it's re-checked here.
      assertUploadableImage(file);
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error("Upload failed - try again.");
      const { storageId } = (await response.json()) as { storageId: string };
      return { storageId, name: file.name, type: file.type };
    },
    [generateUploadUrl],
  );
}

// A blank note means no note, so it's left off the args entirely - the save
// mutation clears any note already stored when the field is absent.
function noteArg(note: string | undefined): { note?: string } {
  const trimmed = note?.trim();
  return trimmed ? { note: trimmed } : {};
}

// The signed `url` an `expenses.get` result carries is derived per read, so
// it's dropped on the way back - only the stored fields travel to the save
// mutation. An absent `image` is how the mutation is told to clear one.
function imageArg(image: ExpenseImage | undefined): { image?: ExpenseStateArgs["image"] } {
  if (!image) return {};
  return { image: { storageId: image.storageId as Id<"_storage">, name: image.name, type: image.type } };
}

export function useExpenseList(): StoredExpense[] {
  const { isAuthenticated } = useConvexAuth();
  const localList = useSyncExternalStore(
    subscribeExpenseList,
    getExpenseListSnapshot,
    getExpenseListServerSnapshot,
  );
  const remoteList = useQuery(api.expenses.list, isAuthenticated ? {} : "skip");
  return isAuthenticated && remoteList ? remoteList : localList;
}

export function useStoredExpense(slug: string): { state: ExpenseState | null; loading: boolean } {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const subscribe = useCallback((callback: () => void) => subscribeExpense(slug, callback), [slug]);
  const localState = useSyncExternalStore(subscribe, () => getExpenseSnapshot(slug), getExpenseServerSnapshot);
  const remoteState = useQuery(api.expenses.get, isAuthenticated ? { slug } : "skip");

  if (authLoading) return { state: null, loading: true };
  if (isAuthenticated) return { state: remoteState ?? null, loading: remoteState === undefined };
  return { state: localState, loading: false };
}

export function useExpenseActions(): {
  save: (slug: string, state: ExpenseState) => void;
  remove: (slug: string) => void;
} {
  const { isAuthenticated } = useConvexAuth();
  const saveMutation = useMutation(api.expenses.save);
  const removeMutation = useMutation(api.expenses.remove);

  const save = useCallback(
    (slug: string, state: ExpenseState) => {
      saveExpense(slug, state);
      if (isAuthenticated) void saveMutation({ slug, state: toExpenseStateArgs(state) });
    },
    [isAuthenticated, saveMutation],
  );

  const remove = useCallback(
    (slug: string) => {
      deleteExpense(slug);
      if (isAuthenticated) void removeMutation({ slug });
    },
    [isAuthenticated, removeMutation],
  );

  return { save, remove };
}

/** Uploads guest-created localStorage expenses to Convex the moment the user signs in. */
export function useSyncLocalExpensesOnLogin(): void {
  const { isAuthenticated } = useConvexAuth();
  const importLocal = useMutation(api.expenses.importLocal);
  const hasSynced = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || hasSynced.current) return;
    hasSynced.current = true;
    const expenses = getExpenseListSnapshot();
    if (expenses.length === 0) return;
    void importLocal({
      expenses: expenses.map(({ slug, state }) => ({ slug, state: toExpenseStateArgs(state) })),
    });
  }, [isAuthenticated, importLocal]);
}
