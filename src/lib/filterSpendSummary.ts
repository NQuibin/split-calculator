import type { ExpenseView } from "@/components/ExpenseViewTabs";
import { isUpcoming } from "./format";
import type { TabCurrencyBreakdown, TabExpenseSummary } from "./tabSync";

export function filterSpendSummary(currencies: TabCurrencyBreakdown[], expenses: TabExpenseSummary[], view: ExpenseView): TabCurrencyBreakdown[] {
  if (view === "all") return currencies;
  const included = expenses.filter(expense => isUpcoming(expense.date) === (view === "upcoming"));
  const slugs = new Set(included.map(expense => expense.slug));
  const round = (value: number) => Math.round(value * 100) / 100;
  return currencies.flatMap(group => {
    const matching = included.filter(expense => expense.settlementCurrency === group.currency);
    if (!matching.length) return [];
    return [{
      ...group,
      expenseCount: matching.length,
      convertedExpenseCount: matching.filter(expense => expense.exchangeRate).length,
      members: group.members.map(member => {
        const lines = member.expenses.filter(expense => slugs.has(expense.expenseSlug));
        return {
          ...member,
          expenses: lines,
          expenseCount: lines.length,
          totalSpent: round(lines.reduce((sum, line) => sum + line.fairShare, 0)),
        };
      }),
    }];
  });
}
