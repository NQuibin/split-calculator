import { round2, type ShareRow } from "./calculations";

export interface ExchangeRate { from: string; to: string; rate: number }

export function activeExchangeRate(expense: { currency?: string; exchangeRate?: ExchangeRate }, target: string): ExchangeRate | undefined {
  const rate = expense.exchangeRate;
  return rate && rate.from === (expense.currency ?? "USD") && rate.to === target && rate.from !== target && Number.isFinite(rate.rate) && rate.rate > 0 ? rate : undefined;
}

/** Allocate rounding cents so converted shares still sum to the converted total. */
export function convertShares(rows: ShareRow[], total: number, rate: number): ShareRow[] {
  const shares = rows.map(row => round2(row.fairShare * rate));
  const difference = Math.round((round2(total * rate) - round2(shares.reduce((sum, share) => sum + share, 0))) * 100);
  const order = rows.map((row, index) => ({ index, amount: row.fairShare })).sort((a, b) => b.amount - a.amount);
  if (order.length) for (let i = 0; i < Math.abs(difference); i++) shares[order[i % order.length].index] = round2(shares[order[i % order.length].index] + Math.sign(difference) / 100);
  return rows.map((row, index) => ({ ...row, fairShare: shares[index] }));
}
