// @vitest-environment happy-dom
import { createElement } from "react";
import { expect, test } from "vitest";
import { StageExpense } from "@/components/StageExpense";
import { renderMarkup } from "@/test/render";
import type { ExpenseAdjustments, ExpenseItem, Person } from "@/lib/types";

const people: Person[] = [
  { id: "one", name: "Alex" },
  { id: "two", name: "Blair" },
  { id: "three", name: "Casey" },
];

const item: ExpenseItem = {
  id: "meal",
  name: "Meal",
  cost: 12,
  discount: { mode: "amount", value: 0 },
  tax: { mode: "percent", value: 0 },
  tip: { mode: "percent", value: 0 },
  splitWith: ["one", "two"],
};

function renderExpense(
  items: ExpenseItem[],
  options: { mode?: "simple" | "itemized"; globalAdjustments?: ExpenseAdjustments } = {},
) {
  return renderMarkup(
    createElement(StageExpense, {
      expenseName: "Dinner",
      people,
      mode: options.mode ?? "itemized",
      items,
      globalAdjustments: options.globalAdjustments,
      onRenameExpense: () => {},
      onSetGlobalAdjustments: () => {},
      date: "2026-10-22",
      currency: "CAD",
      onSetNote: () => {},
      onPickReceipt: () => {},
      canUploadImage: false,
      onSetMode: () => {},
      onSetDate: () => {},
      onSetCurrency: () => {},
      onSetPayer: () => {},
      onAddItem: () => {},
      onUpdateItem: () => {},
      onRemoveItem: () => {},
      onAddPerson: () => {},
      onRemovePerson: () => {},
      onRenamePerson: () => {},
      continueLabel: "Save",
      onContinue: () => {},
    }),
  );
}

test("shows live read-only itemized shares for every member, including zero shares", () => {
  const markup = renderExpense([item]);

  expect(markup).toContain("Each person owes");
  expect(markup).toContain("$6.00");
  expect(markup).toContain("Casey");
  expect(markup).toContain("$0.00");
  expect(markup).not.toContain('type="checkbox"');

  const updated = renderExpense([{ ...item, cost: 20 }]);
  expect(updated).toContain("$10.00");
  expect(updated).toContain("$0.00");
});

test("shows adjusted total and shares in One total mode with global adjustments", () => {
  const markup = renderExpense([{ ...item, cost: 100 }], {
    mode: "simple",
    globalAdjustments: {
      discount: { mode: "percent", value: 10 },
      tax: { mode: "percent", value: 10 },
      tip: { mode: "percent", value: 20 },
      tipAfterTax: true,
    },
  });

  expect(markup).toContain("One total");
  expect(markup).toContain("Itemized");
  expect(markup).toContain("Amount before adjustments");
  expect(markup).toContain("Apply tip after tax");
  expect(markup).toContain('role="switch"');
  expect(markup).toContain("Total, including adjustments");
  expect(markup).toContain("$118.80");
  expect(markup).toContain("$59.40");
});

test("shows the pre-tax tip calculation when One total tip is not after tax", () => {
  const markup = renderExpense([{ ...item, cost: 100 }], {
    mode: "simple",
    globalAdjustments: {
      discount: { mode: "percent", value: 10 },
      tax: { mode: "percent", value: 10 },
      tip: { mode: "percent", value: 20 },
      tipAfterTax: false,
    },
  });

  expect(markup).toContain("Apply tip after tax");
  expect(markup).toContain('aria-checked="false"');
  expect(markup).toContain("$117.00");
  expect(markup).toContain("$58.50");
});

test.each([
  { splitType: "percentage" as const, splitValues: [20, 80], label: "percentage" },
  { splitType: "amount" as const, splitValues: [20, 80], label: "amount" },
])("previews adjusted One total shares for a $label split", ({ splitType, splitValues }) => {
  const markup = renderExpense(
    [
      {
        ...item,
        cost: 100,
        splitType,
        splitValues: [
          { memberId: "one", value: splitValues[0] },
          { memberId: "two", value: splitValues[1] },
        ],
      },
    ],
    {
      mode: "simple",
      globalAdjustments: {
        discount: { mode: "percent", value: 10 },
        tax: { mode: "percent", value: 10 },
        tip: { mode: "percent", value: 20 },
        tipAfterTax: true,
      },
    },
  );

  expect(markup).toContain("$23.76");
  expect(markup).toContain("$95.04");
});
