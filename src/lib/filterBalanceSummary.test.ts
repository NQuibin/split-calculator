import { expect, test } from "vitest";
import { filterBalanceSummary } from "./filterBalanceSummary";
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
    totalSpent: 30, totalContributed: 20, netBalance: -10, expenseCount: 2,
    expenses: [
      { expenseSlug: "paid", expenseName: "Paid", date: "2020-01-01", fairShare: 10, contributed: 20, balance: 10 },
      { expenseSlug: "future", expenseName: "Future", date: "9999-12-31", fairShare: 20, contributed: 0, balance: -20 },
    ],
  }],
}, { currency: "USD", expenseCount: 1, convertedExpenseCount: 0, members: [] }];

test("paid balances exclude future contributions, charges and currencies", () => {
  const result = filterBalanceSummary(currencies, expenses, "paid");
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ currency: "CAD", expenseCount: 1, convertedExpenseCount: 0 });
  expect(result[0].members[0]).toMatchObject({ totalSpent: 10, totalContributed: 20, netBalance: 10, expenseCount: 1 });
});

test("upcoming balances include converted future expenses independently per currency", () => {
  const result = filterBalanceSummary(currencies, expenses, "upcoming");
  expect(result.map(group => group.currency)).toEqual(["CAD", "USD"]);
  expect(result[0].convertedExpenseCount).toBe(1);
  expect(result[0].members[0]).toMatchObject({ totalSpent: 20, totalContributed: 0, netBalance: -20 });
});

test("all retains original totals and an empty view has no currency groups", () => {
  expect(filterBalanceSummary(currencies, expenses, "all")).toBe(currencies);
  expect(filterBalanceSummary(currencies, expenses.slice(1), "paid")).toEqual([]);
});
