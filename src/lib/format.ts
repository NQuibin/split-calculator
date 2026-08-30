export function currency(n: number): string {
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
