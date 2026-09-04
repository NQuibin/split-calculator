import { todayISODate } from "./format";
import type { ExpenseState } from "./types";

const PREFIX = "split-calculator:expense:";

type Listener = () => void;

export interface StoredExpense {
  slug: string;
  state: ExpenseState;
}

const listeners = new Map<string, Set<Listener>>();
const listListeners = new Set<Listener>();
const cache = new Map<string, { raw: string | null; parsed: ExpenseState | null }>();
let listCache: { raw: string; result: StoredExpense[] } | null = null;
const EMPTY_LIST: StoredExpense[] = [];

function parse(raw: string | null): ExpenseState | null {
  if (!raw) return null;
  try {
    const state = JSON.parse(raw) as ExpenseState;
    // Expenses saved before the date field existed don't have one - default
    // to today rather than leaving the picker blank.
    const withDate = state.date ? state : { ...state, date: todayISODate() };
    // Same for contributions, added after some expenses were already saved.
    const withContributions = withDate.contributions ? withDate : { ...withDate, contributions: [] };
    // Same for mode, added after some expenses were already saved as plain
    // item breakdowns.
    return withContributions.mode ? withContributions : { ...withContributions, mode: "itemized" };
  } catch {
    return null;
  }
}

export function getExpenseSnapshot(slug: string): ExpenseState | null {
  const raw = window.localStorage.getItem(PREFIX + slug);
  const cached = cache.get(slug);
  if (cached && cached.raw === raw) return cached.parsed;
  const parsed = parse(raw);
  cache.set(slug, { raw, parsed });
  return parsed;
}

export function getExpenseServerSnapshot(): null {
  return null;
}

export function subscribeExpense(slug: string, callback: Listener): () => void {
  let set = listeners.get(slug);
  if (!set) {
    set = new Set();
    listeners.set(slug, set);
  }
  set.add(callback);
  return () => set.delete(callback);
}

export function getExpenseListSnapshot(): StoredExpense[] {
  const entries: { key: string; raw: string | null }[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith(PREFIX)) {
      entries.push({ key, raw: window.localStorage.getItem(key) });
    }
  }

  const raw = entries.map((e) => `${e.key}=${e.raw}`).join(" ");
  if (listCache && listCache.raw === raw) return listCache.result;

  const result = entries
    .map(({ key, raw }): StoredExpense | null => {
      const state = parse(raw);
      return state ? { slug: key.slice(PREFIX.length), state } : null;
    })
    .filter((r): r is StoredExpense => r !== null)
    .sort((a, b) => (b.state.updatedAt ?? 0) - (a.state.updatedAt ?? 0));

  listCache = { raw, result };
  return result;
}

export function getExpenseListServerSnapshot(): StoredExpense[] {
  return EMPTY_LIST;
}

export function subscribeExpenseList(callback: Listener): () => void {
  listListeners.add(callback);
  return () => listListeners.delete(callback);
}

export function saveExpense(slug: string, state: ExpenseState): void {
  if (state.items.length === 0) {
    window.localStorage.removeItem(PREFIX + slug);
  } else {
    const stamped: ExpenseState = { ...state, updatedAt: Date.now() };
    window.localStorage.setItem(PREFIX + slug, JSON.stringify(stamped));
  }
  listeners.get(slug)?.forEach((callback) => callback());
  listListeners.forEach((callback) => callback());
}

export function deleteExpense(slug: string): void {
  window.localStorage.removeItem(PREFIX + slug);
  listeners.get(slug)?.forEach((callback) => callback());
  listListeners.forEach((callback) => callback());
}
