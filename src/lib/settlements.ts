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

/** Copy for a signed-in member's own net balance in an expense row. */
export function viewerBalanceLabel(balance: number) {
  return balance < 0 ? "You owe" : "You get";
}

/** Compute paid, owed, and net balance for one expense. A missing/invalid payer is intentionally unusable. */
export function computeExpenseBalances(
  people: Person[],
  split: SplitResult,
  payerId?: string,
): SettlementBalance[] {
  if (!payerId || !people.some((p) => p.id === payerId)) return [];
  const shares = new Map(computeShares(split).map((row) => [row.personId, row.fairShare]));
  return people.map((person) => {
    const share = round2(shares.get(person.id) ?? 0);
    const paid = person.id === payerId ? round2(split.grandTotal) : 0;
    return { memberId: person.id, name: person.name, paid, share, balance: round2(paid - share) };
  });
}

/**
 * Which of an expense's `people` actually owe or get money back on it - a
 * nonzero net balance, not mere membership. `people` on an expense is who's
 * been added as a split *candidate*; someone in that list with no items
 * assigned to them (an itemized split) or a 0% share nets to a zero balance
 * and isn't really part of this split. `balances` is `[]` whenever the payer
 * isn't resolved yet, in which case nobody's balance is defined either way -
 * fall back to the full candidate list rather than showing no one.
 *
 * Shared between the client (the tab's expense list) and the server (the
 * expenses directory, `convex/expenses.ts`) so both surfaces draw the same
 * line around "who's in this split" from the same rule.
 */
export function splitParticipants<P extends { id: string }>(
  people: P[],
  balances: { memberId: string; balance: number }[],
): P[] {
  if (!balances.length) return people;
  const nonZero = new Set(balances.filter((b) => b.balance !== 0).map((b) => b.memberId));
  return people.filter((person) => nonZero.has(person.id));
}

/** Deterministic greedy matching of creditors and debtors, in input order, at cent precision. */
export function suggestSettlements(balances: { memberId: string; balance: number }[]) {
  // Protect draft previews from malformed amounts; never loop on Infinity or NaN.
  if (
    balances.some(
      (row) =>
        !Number.isFinite(row.balance) || !Number.isSafeInteger(Math.round(row.balance * 100)),
    )
  )
    return [];
  const creditors = balances
    .filter((b) => b.balance > 0)
    .map((b) => ({ ...b, cents: Math.round(b.balance * 100) }));
  const debtors = balances
    .filter((b) => b.balance < 0)
    .map((b) => ({ ...b, cents: Math.round(-b.balance * 100) }));
  const result: { fromMemberId: string; toMemberId: string; amount: number }[] = [];
  let i = 0,
    j = 0;
  while (i < debtors.length && j < creditors.length) {
    const cents = Math.min(debtors[i].cents, creditors[j].cents);
    if (cents > 0)
      result.push({
        fromMemberId: debtors[i].memberId,
        toMemberId: creditors[j].memberId,
        amount: cents / 100,
      });
    debtors[i].cents -= cents;
    creditors[j].cents -= cents;
    if (debtors[i].cents === 0) i++;
    if (creditors[j].cents === 0) j++;
  }
  return result;
}
