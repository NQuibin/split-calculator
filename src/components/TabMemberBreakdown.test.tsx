// @vitest-environment happy-dom
import { createElement } from "react";
import { expect, test } from "vitest";
import type { TabBreakdownMember } from "@/lib/tabSync";
import { renderMarkup } from "@/test/render";
import { TabMemberBreakdown } from "./TabMemberBreakdown";

const member: TabBreakdownMember = {
  memberId: "member-1",
  resolvedId: "user-1",
  name: "Nikki Q",
  claimed: true,
  totalSpent: 6.66,
  expenseCount: 1,
  expenses: [
    {
      expenseSlug: "dinner",
      expenseName: "Dinner",
      date: "2026-09-08",
      fairShare: 6.66,
      payerId: "member-1",
      payerName: "Nikki Q",
      total: 20,
    },
  ],
};

test("uses the responsive expense-list layout in the member modal without totals", () => {
  const markup = renderMarkup(
    createElement(TabMemberBreakdown, { member, currencyCode: "CAD", variant: "modal" }),
  );

  expect(markup).toContain(">Date<");
  expect(markup).toContain(">Expense<");
  expect(markup).toContain(">Paid by<");
  expect(markup).toContain(">Total<");
  expect(markup).toContain(">Spent<");
  expect(markup).toContain("Sep 08");
  expect(markup).toContain("Paid by <span");
  expect(markup).toContain("h-8 w-8");
  expect(markup).not.toContain("Total spent");
});

test("preserves the total on the standalone breakdown card", () => {
  const markup = renderMarkup(createElement(TabMemberBreakdown, { member, currencyCode: "CAD" }));

  expect(markup).toContain("Total spent");
});
