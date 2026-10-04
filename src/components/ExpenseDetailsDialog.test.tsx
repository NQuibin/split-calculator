// @vitest-environment happy-dom
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import type { TabExpenseSummary } from "@/lib/tabSync";
import { ExpenseDetailsDialog } from "./ExpenseDetailsDialog";

afterEach(() => document.body.replaceChildren());

test("shows shared member names and amounts without status sublabels", () => {
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
      }),
    ),
  );

  const text = document.body.textContent ?? "";
  expect(text).toContain("Nikki Q");
  expect(text).toContain("Sam");
  expect(text).toContain("P5");
  expect(text).toContain("Paid by");
  expect(text).toContain("10.00");
  expect(text).not.toContain("Payer");
  expect(text).not.toContain("Settled");
  flushSync(() =>
    root.render(
      createElement(ExpenseDetailsDialog, {
        open: false,
        onOpenChange: () => undefined,
        expense: undefined,
        slug: "trip",
        defaultCurrency: "CAD",
        canManage: false,
        members: [],
      }),
    ),
  );
  const closingDialog = document.querySelector('[data-slot="dialog-content"]');
  expect(closingDialog?.hasAttribute("data-closed")).toBe(true);
  expect(closingDialog?.textContent).toContain("Nikki Q");
  root.unmount();
});

test("opens item details with adjustments and member shares, then goes back", () => {
  const onBack = vi.fn();
  const expense: TabExpenseSummary = {
    mode: "itemized",
    date: "2026-09-26",
    createdBy: { id: "nikki", name: "Nikki Q" },
    slug: "dinner",
    name: "Dinner",
    payerId: "nikki",
    people: [
      { id: "nikki", name: "Nikki Q" },
      { id: "sam", name: "Sam" },
    ],
    items: [
      {
        id: "meal",
        name: "Meal",
        cost: 20,
        discount: { mode: "amount", value: 2 },
        tax: { mode: "percent", value: 10 },
        tip: { mode: "amount", value: 3 },
        splitWith: ["nikki", "sam"],
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
          { id: "sam", name: "Sam" },
        ],
        onBack,
      }),
    ),
  );

  const viewItems = [...document.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("View items"),
  );
  const initialPopup = document.querySelector('[data-slot="dialog-content"][data-open]');
  expect(viewItems).toBeDefined();
  expect(document.body.textContent).not.toContain("Item total");
  flushSync(() => viewItems?.click());
  const itemsPopup = document.querySelector<HTMLElement>('[data-slot="dialog-content"][data-open]');
  expect(itemsPopup).not.toBe(initialPopup);
  expect(itemsPopup?.className).toContain("animate-in");
  expect(itemsPopup?.className).toContain("zoom-in-95");
  expect(document.querySelector('[data-slot="dialog-title"]')?.textContent).toBe("Dinner");
  expect(document.body.textContent).toContain("CAD · 1 item");
  expect(document.body.textContent).toContain("Meal");
  expect(document.body.textContent).toContain("Discount ·");
  expect(document.body.textContent).toContain("Tax · 10%");
  expect(document.body.textContent).toContain("Tip");
  expect(document.body.textContent).toContain("11.40");
  expect(document.body.textContent).toContain("22.80");

  flushSync(() =>
    document.querySelector<HTMLButtonElement>('[aria-label="Back to expense details"]')?.click(),
  );
  const detailsPopup = document.querySelector<HTMLElement>(
    '[data-slot="dialog-content"][data-open]',
  );
  expect(detailsPopup).not.toBe(itemsPopup);
  expect(detailsPopup?.className).toContain("animate-in");
  expect(document.body.textContent).toContain("View items");
  expect(document.body.textContent).not.toContain("Item total");
  expect(onBack).not.toHaveBeenCalled();
  flushSync(() =>
    document.querySelector<HTMLButtonElement>('[aria-label="Back to balance"]')?.click(),
  );
  expect(onBack).toHaveBeenCalledOnce();
  root.unmount();
});
