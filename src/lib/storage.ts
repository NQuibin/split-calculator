import { todayISODate } from "./format";
import type { ReceiptState } from "./types";

const PREFIX = "split-calculator:receipt:";

type Listener = () => void;

export interface StoredReceipt {
  slug: string;
  state: ReceiptState;
}

const listeners = new Map<string, Set<Listener>>();
const listListeners = new Set<Listener>();
const cache = new Map<string, { raw: string | null; parsed: ReceiptState | null }>();
let listCache: { raw: string; result: StoredReceipt[] } | null = null;
const EMPTY_LIST: StoredReceipt[] = [];

function parse(raw: string | null): ReceiptState | null {
  if (!raw) return null;
  try {
    const state = JSON.parse(raw) as ReceiptState;
    // Receipts saved before the date field existed don't have one - default
    // to today rather than leaving the picker blank.
    const withDate = state.date ? state : { ...state, date: todayISODate() };
    // Same for contributions, added after some receipts were already saved.
    return withDate.contributions ? withDate : { ...withDate, contributions: [] };
  } catch {
    return null;
  }
}

export function getReceiptSnapshot(slug: string): ReceiptState | null {
  const raw = window.localStorage.getItem(PREFIX + slug);
  const cached = cache.get(slug);
  if (cached && cached.raw === raw) return cached.parsed;
  const parsed = parse(raw);
  cache.set(slug, { raw, parsed });
  return parsed;
}

export function getReceiptServerSnapshot(): null {
  return null;
}

export function subscribeReceipt(slug: string, callback: Listener): () => void {
  let set = listeners.get(slug);
  if (!set) {
    set = new Set();
    listeners.set(slug, set);
  }
  set.add(callback);
  return () => set.delete(callback);
}

export function getReceiptListSnapshot(): StoredReceipt[] {
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
    .map(({ key, raw }): StoredReceipt | null => {
      const state = parse(raw);
      return state ? { slug: key.slice(PREFIX.length), state } : null;
    })
    .filter((r): r is StoredReceipt => r !== null)
    .sort((a, b) => (b.state.updatedAt ?? 0) - (a.state.updatedAt ?? 0));

  listCache = { raw, result };
  return result;
}

export function getReceiptListServerSnapshot(): StoredReceipt[] {
  return EMPTY_LIST;
}

export function subscribeReceiptList(callback: Listener): () => void {
  listListeners.add(callback);
  return () => listListeners.delete(callback);
}

export function saveReceipt(slug: string, state: ReceiptState): void {
  if (state.items.length === 0) {
    window.localStorage.removeItem(PREFIX + slug);
  } else {
    const stamped: ReceiptState = { ...state, updatedAt: Date.now() };
    window.localStorage.setItem(PREFIX + slug, JSON.stringify(stamped));
  }
  listeners.get(slug)?.forEach((callback) => callback());
  listListeners.forEach((callback) => callback());
}

export function deleteReceipt(slug: string): void {
  window.localStorage.removeItem(PREFIX + slug);
  listeners.get(slug)?.forEach((callback) => callback());
  listListeners.forEach((callback) => callback());
}
