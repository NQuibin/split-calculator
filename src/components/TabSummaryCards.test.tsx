// @vitest-environment happy-dom
import { createElement } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { renderMarkup } from "@/test/render";
import type { TabExpenseSummary } from "@/lib/tabSync";
import { TabSummaryCards } from "./TabSummaryCards";

const zero = { mode: "amount" as const, value: 0 };

function expense(slug: string, date: string): TabExpenseSummary {
  return {
    slug,
    name: slug,
    date,
    mode: "simple",
    currency: "CAD",
    settlementCurrency: "CAD",
    createdAt: 0,
    createdBy: { id: "member-1", name: "Nikki" },
    payerId: "member-1",
    people: [{ id: "member-1", name: "Nikki" }],
    items: [
      {
        id: "total",
        name: slug,
        cost: 10,
        splitWith: ["member-1"],
        discount: zero,
        tax: zero,
        tip: zero,
      },
    ],
  };
}

beforeEach(() => vi.useFakeTimers({ now: new Date("2026-09-23T12:00:00Z") }));
afterEach(() => vi.useRealTimers());

test.each([
  ["paid", 1],
  ["upcoming", 1],
  ["all", 2],
] as const)("shows the %s-view expense count", (expenseView, expectedCount) => {
  const markup = renderMarkup(
    createElement(TabSummaryCards, {
      expenses: [expense("paid", "2026-09-23"), expense("upcoming", "2026-09-24")],
      defaultCurrency: "CAD",
      expenseView,
    }),
  );

  expect(markup).toContain(">Expenses</p>");
  expect(markup).toContain(`>${expectedCount}</span>`);
  expect(markup).not.toContain("You spent");
});

test("shows the single settlement currency in a full-width mobile summary card", () => {
  const markup = renderMarkup(
    createElement(TabSummaryCards, {
      expenses: [expense("paid", "2026-09-23")],
      defaultCurrency: "CAD",
      expenseView: "paid",
    }),
  );

  expect(markup).toContain(">Currency</p>");
  expect(markup).toContain("CAD");
  expect(markup).toContain("Canadian Dollar");
  expect(markup).toContain("col-span-2");
  expect(markup).toContain("sm:grid-cols-3");
});

test("omits the currency card when expenses use multiple settlement currencies", () => {
  const markup = renderMarkup(
    createElement(TabSummaryCards, {
      expenses: [
        expense("paid", "2026-09-23"),
        { ...expense("other", "2026-09-23"), settlementCurrency: "USD" },
      ],
      defaultCurrency: "CAD",
      expenseView: "paid",
    }),
  );

  expect(markup).not.toContain(">Currency</p>");
  expect(markup).not.toContain("sm:grid-cols-3");
});

test("shows the default currency before the tab has expenses", () => {
  const markup = renderMarkup(
    createElement(TabSummaryCards, {
      expenses: [],
      defaultCurrency: "CAD",
      expenseView: "paid",
    }),
  );

  expect(markup).toContain(">Currency</p>");
  expect(markup).toContain("Canadian Dollar");
});
