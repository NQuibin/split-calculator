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
