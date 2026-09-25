import { Hash, ReceiptText } from "lucide-react";
import type { ReactNode } from "react";
import { isUpcoming } from "@/lib/format";
import { useLocaleFormatters } from "@/lib/localeFormatters";
import { computeSplit } from "@/lib/calculations";
import type { ExpenseView } from "@/components/ExpenseViewTabs";
import type { TabExpenseSummary } from "@/lib/tabSync";
import { Panel } from "@/components/ui/Page";

type SummaryCardProps = {
  label: string;
  icon: typeof ReceiptText;
  children: ReactNode;
  className?: string;
};

function SummaryCard({ label, icon: Icon, children, className }: SummaryCardProps) {
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
        {children}
        <p className="mt-1 text-xs text-ink-soft">{label}</p>
      </div>
    </Panel>
  );
}

export function TabSummaryCards({
  expenses,
  defaultCurrency,
  expenseView,
}: {
  expenses: TabExpenseSummary[];
  defaultCurrency: string;
  expenseView: ExpenseView;
}) {
  const hasUpcoming = expenses.some((expense) => isUpcoming(expense.date));
  const activeView = hasUpcoming ? expenseView : "paid";
  const visibleExpenses = expenses.filter(
    (expense) =>
      activeView === "all" ||
      (activeView === "upcoming" ? isUpcoming(expense.date) : !isUpcoming(expense.date)),
  );
  const totals = new Map<string, number>();
  for (const expense of visibleExpenses) {
    const split = computeSplit(expense.people, expense.items, expense.globalAdjustments);
    const rate = expense.exchangeRate?.rate ?? 1;
    const amount = split.grandTotal * rate;
    totals.set(expense.settlementCurrency, (totals.get(expense.settlementCurrency) ?? 0) + amount);
  }
  const orderedCodes = [...totals.keys()].sort(
    (a, b) => Number(b === defaultCurrency) - Number(a === defaultCurrency) || a.localeCompare(b),
  );
  const amounts = orderedCodes.map((code) => ({ code, value: totals.get(code) ?? 0 }));
  const { currency } = useLocaleFormatters();

  return (
    <section aria-label="Tab summary" className="grid grid-cols-2 gap-4">
      <SummaryCard
        label="Tab total"
        icon={ReceiptText}
        className="-ml-5 rounded-l-none sm:ml-0 sm:rounded-xl"
      >
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {amounts.map(({ code, value }) => (
            <span key={code} className="font-numeric text-base font-semibold text-ink">
              {currency(value, code)}
            </span>
          ))}
        </div>
      </SummaryCard>
      <SummaryCard
        label="Expenses"
        icon={Hash}
        className="-mr-5 rounded-r-none sm:mr-0 sm:rounded-xl"
      >
        <span className="font-numeric text-base font-semibold text-ink">
          {visibleExpenses.length}
        </span>
      </SummaryCard>
    </section>
  );
}
