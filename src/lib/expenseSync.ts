"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
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
import type { Contribution, Person, RateSetting, ExpenseItem, ExpenseState } from "./types";

// When signed in, Convex is the source of truth (live queries); localStorage
// keeps being written to as a cache so the app still works offline/signed out.

interface ExpenseStateArgs {
  stage: ExpenseState["stage"];
  name?: string;
  people: Person[];
  namePeople: boolean;
  items: ExpenseItem[];
  tax: RateSetting;
  tip: RateSetting;
  date: string;
  contributions: Contribution[];
}

// `state` may carry fields the current expenseState validator doesn't accept:
// top-level extras merged in from an `expenses.get` result (`updatedAt`,
// `tabId`, `tab`), or - for expenses saved by an older version of the
// app - stale per-item fields like a legacy `taxRate` rate setting that
// predates today's `taxed`/`tipped` booleans. Rebuild exactly the shape the
// validator expects, at every nested level, before sending to Convex.
function toExpenseStateArgs(state: ExpenseState): ExpenseStateArgs {
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
