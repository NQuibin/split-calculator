export function currency(n: number): string {
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
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

// Parses a YYYY-MM-DD string as a local date (not UTC, unlike `new Date(str)`).
export function parseISODate(s: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!match) return undefined;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? undefined : date;
}
