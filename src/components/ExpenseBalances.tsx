import { AlertCircle, ArrowRight } from "lucide-react";
import { MemberAvatar } from "@/components/MemberAvatar";
import { GroupTitle } from "@/components/ui/Typography";
import { currency as formatCurrency } from "@/lib/format";
import { computeExpenseBalances, suggestSettlements } from "@/lib/settlements";
import type { Person } from "@/lib/types";
import type { SplitResult } from "@/lib/calculations";

export function ExpenseBalances({ people, split, payerId, currency, projected = false, unallocated = false, headingLevel = "h2" }: { people: Person[]; split: SplitResult; payerId?: string; currency: string; projected?: boolean; unallocated?: boolean; headingLevel?: "h2" | "h3" }) {
  if (!Number.isFinite(split.grandTotal) || split.grandTotal <= 0) {
    return <p className="mt-5 text-sm text-ink-soft">Add an amount to see balances.</p>;
  }
  if (!people.length || !split.people.length || unallocated) {
    return <p className="mt-5 text-sm text-ink-soft">Choose at least one person in the split to see balances.</p>;
  }
  const payer = people.find((person) => person.id === payerId);
  if (!payer) {
    return <div className="mt-5 flex items-start gap-2 rounded-md border border-rule bg-field px-3 py-3 text-sm text-ink-soft"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-brass" aria-hidden="true" /><span>Choose a payer to see what everyone owes.</span></div>;
  }
  const rows = computeExpenseBalances(people, split, payerId);
  const transfers = suggestSettlements(rows);
  return <section className="mt-6 border-t border-rule pt-5" aria-label="Expense balances">
    <GroupTitle as={headingLevel}>{projected ? "Projected balance" : "Who owes what"} <span className="text-ink-soft">· This expense</span></GroupTitle>
    {projected && <p className="mt-1 text-xs text-ink-soft">This expense is dated in the future, so it has not become a debt yet.</p>}
    <div className="mt-3 overflow-x-auto rounded-md border border-edge bg-field">
      <table className="w-full min-w-[28rem] text-sm"><thead className="bg-band text-left text-xs text-ink-soft"><tr><th className="px-3 py-2 font-medium">Person</th><th className="px-3 py-2 text-right font-medium">Paid</th><th className="px-3 py-2 text-right font-medium">Share</th><th className="px-3 py-2 text-right font-medium">Balance</th></tr></thead><tbody className="divide-y divide-rule">{rows.map((row) => <tr key={row.memberId}><th scope="row" className="px-3 py-3 text-left font-medium"><span className="flex items-center gap-2"><MemberAvatar id={row.memberId} name={row.name} /><span className="break-words">{row.name}</span></span></th><td className="font-numeric px-3 py-3 text-right">{formatCurrency(row.paid, currency)}</td><td className="font-numeric px-3 py-3 text-right">{formatCurrency(row.share, currency)}</td><td className={`font-numeric px-3 py-3 text-right ${row.balance > 0 ? "text-ledger-green" : row.balance < 0 ? "text-margin-red-ink" : "text-ink-soft"}`}>{row.balance > 0 ? `Receives ${formatCurrency(row.balance, currency)}` : row.balance < 0 ? `Owes ${formatCurrency(Math.abs(row.balance), currency)}` : "Settled"}</td></tr>)}</tbody></table>
    </div>
    {transfers.length > 0 && <div className="mt-4 space-y-2"><p className="text-xs font-medium text-ink-soft">Suggested transfers</p>{transfers.map((transfer) => { const from = people.find((person) => person.id === transfer.fromMemberId); const to = people.find((person) => person.id === transfer.toMemberId); if (!from || !to) return null; return <div key={`${transfer.fromMemberId}-${transfer.toMemberId}`} className="flex items-center gap-2 text-sm"><span className="min-w-0 break-words">{from.name}</span><ArrowRight className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden="true" /><span className="min-w-0 break-words">{to.name}</span><span className="font-numeric ml-auto shrink-0">{formatCurrency(transfer.amount, currency)}</span></div>; })}</div>}
  </section>;
}
