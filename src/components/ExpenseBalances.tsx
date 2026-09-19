import { AlertCircle, MoveDown, MoveUp } from "lucide-react";
import { MemberAvatar } from "@/components/MemberAvatar";
import { GroupTitle } from "@/components/ui/Typography";
import { currency as formatCurrency } from "@/lib/format";
import { computeExpenseBalances } from "@/lib/settlements";
import type { Person } from "@/lib/types";
import type { SplitResult } from "@/lib/calculations";

export function ExpenseBalances({
  people,
  split,
  payerId,
  currency,
  projected = false,
  unallocated = false,
  headingLevel = "h2",
}: {
  people: Person[];
  split: SplitResult;
  payerId?: string;
  currency: string;
  projected?: boolean;
  unallocated?: boolean;
  headingLevel?: "h2" | "h3";
}) {
  if (!Number.isFinite(split.grandTotal) || split.grandTotal <= 0) {
    return <p className="mt-5 text-sm text-ink-soft">Add an amount to see balances.</p>;
  }
  if (!people.length || !split.people.length || unallocated) {
    return (
      <p className="mt-5 text-sm text-ink-soft">
        Choose at least one person in the split to see balances.
      </p>
    );
  }
  const payer = people.find((person) => person.id === payerId);
  if (!payer) {
    return (
      <div className="mt-5 flex items-start gap-2 rounded-md border border-rule bg-field px-3 py-3 text-sm text-ink-soft">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-brass" aria-hidden="true" />
        <span>Choose a payer to see what everyone owes.</span>
      </div>
    );
  }
  const rows = computeExpenseBalances(people, split, payerId);
  return (
    <section className="mt-6 border-t border-rule pt-5" aria-label="Expense balances">
      <GroupTitle as={headingLevel}>
        {projected ? "Projected balance" : "Who owes what"}{" "}
        <span className="text-ink-soft">· This expense</span>
      </GroupTitle>
      {projected && (
        <p className="mt-1 text-xs text-ink-soft">
          This expense is dated in the future, so it has not become a debt yet.
        </p>
      )}
      {/* Ruled rather than boxed (DESIGN.md "Data tables"): the header sits on
          the card, and the body carries both `--edge` rules and the field
          ground. Preflight collapses table borders, so a `<tbody>` border
          draws. The table bleeds to its host's edges; the edge cells put the
          host's inset back so the first and last columns line up with it. */}
      <div className="bleed mt-3 overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm [&_tr>:first-child]:bleed-pl [&_tr>:last-child]:bleed-pr">
          <thead className="text-left text-xs text-ink-soft">
            <tr>
              <th className="px-3 py-2 font-medium">Person</th>
              <th className="px-3 py-2 text-right font-medium">Paid</th>
              <th className="px-3 py-2 text-right font-medium">Share</th>
              <th className="px-3 py-2 text-right font-medium">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule border-y border-edge bg-field">
            {rows.map((row) => (
              <tr key={row.memberId}>
                <th scope="row" className="px-3 py-3 text-left font-medium">
                  <span className="flex items-center gap-2">
                    <MemberAvatar id={row.memberId} name={row.name} />
                    <span className="break-words">{row.name}</span>
                  </span>
                </th>
                <td className="font-numeric px-3 py-3 text-right">
                  {formatCurrency(row.paid, currency)}
                </td>
                <td className="font-numeric px-3 py-3 text-right">
                  {formatCurrency(row.share, currency)}
                </td>
                <td
                  className={`font-numeric px-3 py-3 text-right ${row.balance > 0 ? "text-ledger-green" : row.balance < 0 ? "text-margin-red-ink" : "text-ink"}`}
                >
                  <span className="inline-flex items-center justify-end gap-1 whitespace-nowrap">
                    {row.balance > 0
                      ? `Gets ${formatCurrency(row.balance, currency)}`
                      : row.balance < 0
                        ? `Owes ${formatCurrency(Math.abs(row.balance), currency)}`
                        : projected
                          ? "Not due"
                          : "Settled"}
                    {row.balance > 0 ? (
                      <MoveUp aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={2.5} />
                    ) : row.balance < 0 ? (
                      <MoveDown aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={2.5} />
                    ) : null}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
