// @vitest-environment happy-dom
import { createElement } from "react";
import { expect, test } from "vitest";
import { StageExpense } from "@/components/StageExpense";
import { renderMarkup } from "@/test/render";
import type { ExpenseItem, Person } from "@/lib/types";

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

function renderExpense(items: ExpenseItem[]) {
  return renderMarkup(
    createElement(StageExpense, {
      expenseName: "Dinner",
      people,
      mode: "itemized",
      items,
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
