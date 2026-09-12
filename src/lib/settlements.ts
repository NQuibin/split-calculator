import { computeShares, type SplitResult } from "./calculations";
import { round2 } from "./calculations";
import type { Person } from "./types";

export interface SettlementBalance {
  memberId: string;
  name: string;
  paid: number;
  share: number;
  balance: number;
}

/** Compute paid, owed, and net balance for one expense. A missing/invalid payer is intentionally unusable. */
export function computeExpenseBalances(people: Person[], split: SplitResult, payerId?: string): SettlementBalance[] {
  if (!payerId || !people.some((p) => p.id === payerId)) return [];
  const shares = new Map(computeShares(split).map((row) => [row.personId, row.fairShare]));
  return people.map((person) => {
    const share = round2(shares.get(person.id) ?? 0);
    const paid = person.id === payerId ? round2(split.grandTotal) : 0;
    return { memberId: person.id, name: person.name, paid, share, balance: round2(paid - share) };
  });
}

/** Deterministic greedy matching of creditors and debtors, in input order, at cent precision. */
export function suggestSettlements(balances: { memberId: string; balance: number }[]) {
  // Protect draft previews from malformed amounts; never loop on Infinity or NaN.
  if (balances.some(row => !Number.isFinite(row.balance) || !Number.isSafeInteger(Math.round(row.balance * 100)))) return [];
  const creditors = balances.filter((b) => b.balance > 0).map((b) => ({ ...b, cents: Math.round(b.balance * 100) }));
  const debtors = balances.filter((b) => b.balance < 0).map((b) => ({ ...b, cents: Math.round(-b.balance * 100) }));
  const result: { fromMemberId: string; toMemberId: string; amount: number }[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const cents = Math.min(debtors[i].cents, creditors[j].cents);
    if (cents > 0) result.push({ fromMemberId: debtors[i].memberId, toMemberId: creditors[j].memberId, amount: cents / 100 });
    debtors[i].cents -= cents; creditors[j].cents -= cents;
    if (debtors[i].cents === 0) i++;
    if (creditors[j].cents === 0) j++;
  }
  return result;
}
