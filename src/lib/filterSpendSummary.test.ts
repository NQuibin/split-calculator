import { expect, test } from "vitest";
import { filterSpendSummary } from "./filterSpendSummary";
import type { TabCurrencyBreakdown, TabExpenseSummary } from "./tabSync";

const expenses = [
  { slug: "paid", date: "2020-01-01", settlementCurrency: "CAD" },
  { slug: "future", date: "9999-12-31", settlementCurrency: "CAD", exchangeRate: { rate: 2 } },
  { slug: "usd", date: "9999-12-31", settlementCurrency: "USD" },
] as TabExpenseSummary[];
const currencies: TabCurrencyBreakdown[] = [{
  currency: "CAD", expenseCount: 2, convertedExpenseCount: 1,
  members: [{
    memberId: "m", resolvedId: "m", name: "Member", claimed: true,
    totalSpent: 30, expenseCount: 2,
    expenses: [
      { expenseSlug: "paid", expenseName: "Paid", date: "2020-01-01", fairShare: 10 },
      { expenseSlug: "future", expenseName: "Future", date: "9999-12-31", fairShare: 20 },
    ],
  }],
}, { currency: "USD", expenseCount: 1, convertedExpenseCount: 0, members: [] }];

test("paid totals exclude future charges and other currencies", () => {
  const result = filterSpendSummary(currencies, expenses, "paid");
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ currency: "CAD", expenseCount: 1, convertedExpenseCount: 0 });
  expect(result[0].members[0]).toMatchObject({ totalSpent: 10, expenseCount: 1 });
});

test("upcoming totals include converted future expenses independently per currency", () => {
  const result = filterSpendSummary(currencies, expenses, "upcoming");
  expect(result.map(group => group.currency)).toEqual(["CAD", "USD"]);
  expect(result[0].convertedExpenseCount).toBe(1);
  expect(result[0].members[0]).toMatchObject({ totalSpent: 20 });
});

test("all retains original totals and an empty view has no currency groups", () => {
  expect(filterSpendSummary(currencies, expenses, "all")).toBe(currencies);
  expect(filterSpendSummary(currencies, expenses.slice(1), "paid")).toEqual([]);
});
