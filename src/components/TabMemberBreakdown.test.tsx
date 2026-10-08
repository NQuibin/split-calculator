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
  expenseCount: 2,
  expenses: [
    {
      expenseSlug: "dinner",
      expenseName: "Dinner",
      date: "2026-09-08",
      fairShare: 6.66,
      balance: 13.34,
      viewerBalance: 4,
      sharedWithViewer: true,
      payerId: "member-1",
      payerName: "Nikki Q",
      total: 20,
    },
    {
      expenseSlug: "lunch",
      expenseName: "Lunch",
      date: "2026-09-09",
      fairShare: 5,
      balance: 5,
      sharedWithViewer: false,
      payerId: "member-1",
      payerName: "Nikki Q",
      total: 10,
    },
  ],
};

test("shows only expenses shared with the viewer and keeps expense rows clickable", () => {
  const markup = renderMarkup(
    createElement(TabMemberBreakdown, {
      member,
      currencyCode: "CAD",
      onExpenseClick: () => {},
    }),
  );

  expect(markup).toContain("Dinner");
  expect(markup).not.toContain("Lunch");
  expect(markup).toContain("You lent");
  expect(markup).not.toContain("You spent");
  expect(markup).toContain("CA$20.00");
  expect(markup).not.toContain("Settlement breakdown");
  expect(markup).not.toContain("Total spent");
});

test("shows an empty state when no expenses are shared with the viewer", () => {
  const markup = renderMarkup(
    createElement(TabMemberBreakdown, {
      member: { ...member, expenses: [member.expenses[1]] },
      currencyCode: "CAD",
    }),
  );

  expect(markup).toContain("No related expenses.");
  expect(markup).not.toContain(">Date<");
});

test("shows the selected member's partial settlement beneath a related expense balance", () => {
  const markup = renderMarkup(
    createElement(TabMemberBreakdown, {
      member,
      currencyCode: "CAD",
      expenseStatuses: [
        { expenseSlug: "dinner", memberId: "member-1", status: "partiallySettled" },
        { expenseSlug: "dinner", memberId: "someone-else", status: "settled" },
      ],
    }),
  );

  expect(markup).toContain("Partially settled");
  expect(markup).toContain("bg-partially-settled-chip");
  expect(markup).not.toContain(">Settled<");
});

test("renders headerless expense rows with a desktop payer and balance", () => {
  const markup = renderMarkup(createElement(TabMemberBreakdown, { member, currencyCode: "CAD" }));

  expect(markup).not.toContain(">Date<");
  expect(markup).not.toContain(">Paid by<");
  expect(markup).toContain("@min-[38rem]:col-start-3 @min-[38rem]:flex");
  expect(markup).toContain("block break-words text-sm text-ink-soft");
  expect(markup).toContain("@min-[38rem]:grid");
  expect(markup).toContain("minmax(0,1.25fr)_minmax(0,1fr)");
  expect(markup).toContain("@min-[56rem]:gap-x-6");
});
