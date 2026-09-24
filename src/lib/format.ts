import { DEFAULT_LOCALE } from "./locale";

export function currency(n: number, code: string = "USD", locale = DEFAULT_LOCALE): string {
  if (!Number.isFinite(n)) return "-";
  try {
    return n.toLocaleString(locale, { style: "currency", currency: code });
  } catch {
    return n.toLocaleString(locale, { style: "currency", currency: "USD" });
  }
}

// Local calendar date (not UTC, unlike Date#toISOString) formatted YYYY-MM-DD.
export function toISODate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

export function todayISODate(): string {
  return toISODate(new Date());
}

// Strictly validates the canonical calendar-date form used by expenses and
// settlement as-of dates. Comparing the normalized UTC date rejects values
// such as 2026-02-30 rather than letting Date.parse roll them over.
export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

// How an expense's date reads everywhere it's listed, e.g. "Mar 3, 2027".
// Undefined when there's no date, so callers can fall back to their own copy.
export function formatExpenseDate(
  iso: string | undefined,
  locale = DEFAULT_LOCALE,
): string | undefined {
  return (iso ? parseISODate(iso) : undefined)?.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// The compact form for a dense list column, e.g. "Mar 03". The year is dropped
// so the column stays narrow, which means the full date has to survive
// somewhere - always pair this with a `<time dateTime>` carrying the ISO value.
export function formatExpenseDateShort(
  iso: string | undefined,
  locale = DEFAULT_LOCALE,
): string | undefined {
  return (iso ? parseISODate(iso) : undefined)?.toLocaleDateString(locale, {
    month: "short",
    day: "2-digit",
  });
}

// An expense dated after today hasn't been charged yet. Both sides are
// YYYY-MM-DD, so comparing the strings is the same as comparing the dates -
// and it avoids the timezone drift that parsing to Date invites.
export function isUpcoming(date: string | undefined): boolean {
  return date !== undefined && date > todayISODate();
}

// Parses a YYYY-MM-DD string as a local date (not UTC, unlike `new Date(str)`).
export function parseISODate(s: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!match) return undefined;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? undefined : date;
}
