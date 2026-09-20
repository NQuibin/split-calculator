import { ReceiptText, Wallet } from "lucide-react";
import { useQuery } from "convex/react";

import { api } from "../../convex/_generated/api";
import { currency } from "@/lib/format";
import { computeSplit } from "@/lib/calculations";
import type { TabExpenseSummary, TabMemberSummary } from "@/lib/tabSync";
import { Panel } from "@/components/ui/Page";

type SummaryCardProps = {
  label: string;
  icon: typeof Wallet;
  amounts: { code: string; value: number }[] | undefined;
  className?: string;
};

function SummaryCard({ label, icon: Icon, amounts, className }: SummaryCardProps) {
  return (
    <Panel
      bleedOnMobile={false}
      className={`flex min-w-0 items-start gap-3 p-4 sm:p-5 ${className ?? ""}`}
    >
      <span
        aria-hidden="true"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest/10 text-brass"
      >
        <Icon className="h-5 w-5" strokeWidth={2.25} />
      </span>
      <div className="min-w-0">
        {amounts ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {amounts.map(({ code, value }) => (
              <span key={code} className="font-numeric text-lg font-semibold text-ink">
                {currency(value, code)}
              </span>
            ))}
          </div>
        ) : (
          <span className="block text-sm text-ink-soft">Loading…</span>
        )}
        <p className="mt-1 text-xs text-ink-soft">{label}</p>
      </div>
    </Panel>
  );
}

export function TabSummaryCards({
  expenses,
  members,
  defaultCurrency,
}: {
  expenses: TabExpenseSummary[];
  members: TabMemberSummary[];
  defaultCurrency: string;
}) {
  const viewer = useQuery(api.users.viewer);
  const viewerMember = viewer
    ? members.find((member) => member.resolvedId === viewer._id)
    : undefined;
  const viewerIds = new Set(viewerMember ? [viewerMember.id, viewerMember.resolvedId] : []);
  const totals = new Map<string, number>();
  const viewerTotals = new Map<string, number>();
  for (const expense of expenses) {
    const total = computeSplit(expense.people, expense.items, expense.globalAdjustments).grandTotal;
    const rate = expense.exchangeRate?.rate ?? 1;
    const amount = total * rate;
    totals.set(expense.settlementCurrency, (totals.get(expense.settlementCurrency) ?? 0) + amount);
    if (expense.payerId && viewerIds.has(expense.payerId)) {
      viewerTotals.set(
        expense.settlementCurrency,
        (viewerTotals.get(expense.settlementCurrency) ?? 0) + amount,
      );
    }
  }
  const orderedCodes = [...totals.keys()].sort(
    (a, b) => Number(b === defaultCurrency) - Number(a === defaultCurrency) || a.localeCompare(b),
  );
  const amounts = orderedCodes.map((code) => ({ code, value: totals.get(code) ?? 0 }));
  const viewerAmounts =
    viewer === undefined
      ? undefined
      : orderedCodes.map((code) => ({
          code,
          value: viewerTotals.get(code) ?? 0,
        }));

  return (
    <section aria-label="Tab summary" className="grid grid-cols-2 gap-4">
      <SummaryCard
        label="Tab total"
        icon={ReceiptText}
        amounts={amounts}
        className="-ml-5 sm:ml-0"
      />
      <SummaryCard
        label="You spent"
        icon={Wallet}
        amounts={viewerAmounts}
        className="-mr-5 sm:mr-0"
      />
    </section>
  );
}
