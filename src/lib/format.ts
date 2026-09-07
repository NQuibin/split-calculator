export function currency(n: number, code: string = "USD"): string {
  if (!Number.isFinite(n)) return "-";
  try {
    return n.toLocaleString("en-US", { style: "currency", currency: code });
  } catch {
    return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
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

// How an expense's date reads everywhere it's listed, e.g. "Mar 3, 2027".
// Undefined when there's no date, so callers can fall back to their own copy.
export function formatExpenseDate(iso: string | undefined): string | undefined {
  return (iso ? parseISODate(iso) : undefined)?.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
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
