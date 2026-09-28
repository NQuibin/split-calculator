// @vitest-environment happy-dom
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test } from "vitest";
import type { TabExpenseSummary } from "@/lib/tabSync";
import { ExpenseDetailsDialog } from "./ExpenseDetailsDialog";

afterEach(() => document.body.replaceChildren());

test("shows each member's settled, partial, or payer status under their share", () => {
  const zero = { mode: "amount" as const, value: 0 };
  const expense: TabExpenseSummary = {
    mode: "simple",
    date: "2026-09-26",
    createdBy: { id: "nikki", name: "Nikki Q" },
    slug: "dinner",
    name: "Dinner",
    payerId: "p5",
    people: [
      { id: "nikki", name: "Nikki Q" },
      { id: "p5", name: "P5" },
      { id: "sam", name: "Sam" },
    ],
    items: [
      {
        id: "total",
        name: "Total",
        cost: 30,
        discount: zero,
        tax: zero,
        tip: zero,
        splitWith: ["nikki", "p5", "sam"],
      },
    ],
    currency: "CAD",
    settlementCurrency: "CAD",
    createdAt: 0,
  };
  const root = createRoot(document.createElement("div"));
  flushSync(() =>
    root.render(
      createElement(ExpenseDetailsDialog, {
        open: true,
        onOpenChange: () => undefined,
        expense,
        slug: "trip",
        defaultCurrency: "CAD",
        canManage: false,
        members: [
          { id: "nikki", name: "Nikki Q" },
          { id: "p5", name: "P5" },
          { id: "sam", name: "Sam" },
        ],
        paymentStatuses: [
          { memberId: "nikki", share: 10, paid: 10, currency: "CAD" },
          { memberId: "sam", share: 10, paid: 4, currency: "CAD" },
        ],
      }),
    ),
  );

  const text = document.body.textContent ?? "";
  expect(text).toContain("Settled");
  expect(text).toContain("Partial (CA$4.00 paid)");
  expect(text).toContain("Payer");
  root.unmount();
});
