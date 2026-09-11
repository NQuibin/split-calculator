import { expect, test } from "vitest";
import { computeSplit } from "./calculations";
import { expenseReducer } from "./reducer";
import type { ExpenseAdjustments, ExpenseItem, ExpenseState } from "./types";

const zero = { mode: "amount" as const, value: 0 };
const people = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
const item = (id: string, cost: number, overrideAdjustments = false): ExpenseItem => ({
  id, name: id, cost, splitWith: [id === "a" ? "a" : "b"],
  discount: zero, tax: zero, tip: zero, overrideAdjustments,
});
const global: ExpenseAdjustments = {
  discount: { mode: "percent", value: 10 },
  tax: { mode: "percent", value: 10 },
  tip: { mode: "percent", value: 20 },
};

test("global percentages apply after discount and follow each item's sharers", () => {
  const result = computeSplit(people, [item("a", 100), item("b", 50)], global);
  expect(result).toMatchObject({ subtotal: 135, taxTotal: 13.5, tipTotal: 27, grandTotal: 175.5 });
  expect(result.people.map(p => p.total)).toEqual([117, 58.5]);
});

test("fixed globals apply once and exclude an explicit zero override", () => {
  const result = computeSplit(people, [item("a", 100), item("b", 50), item("exempt", 80, true)], {
    discount: { mode: "amount", value: 30 }, tax: { mode: "amount", value: 12 }, tip: { mode: "amount", value: 18 },
  });
  expect(result.items.map(i => i.total)).toEqual([100, 50, 80]);
  expect(result.items.map(i => i.discountAmount)).toEqual([20, 10, 0]);
  expect(result.grandTotal).toBe(230);
});

test("individual adjustments replace globals, including zero tax and tip", () => {
  const own = { ...item("b", 50, true), discount: { mode: "amount" as const, value: 5 } };
  expect(computeSplit(people, [item("a", 100), own], global).items.map(i => i.total)).toEqual([117, 45]);
  const unchecked = { ...own, overrideAdjustments: false };
  expect(computeSplit(people, [unchecked], global).grandTotal).toBe(58.5);
  expect(computeSplit(people, [unchecked]).grandTotal).toBe(50);
});

test("old individual adjustments survive without a flag", () => {
  const old = { ...item("a", 100), overrideAdjustments: undefined, tax: { mode: "percent" as const, value: 5 } };
  expect(computeSplit(people, [old], global).grandTotal).toBe(105);
});

test("empty, all exempt, and fully discounted expenses receive no global charges", () => {
  expect(computeSplit(people, [], global).grandTotal).toBe(0);
  expect(computeSplit(people, [item("a", 100, true)], global).grandTotal).toBe(100);
  expect(computeSplit(people, [item("a", 100)], { ...global, discount: { mode: "amount", value: 200 } }).grandTotal).toBe(0);
});

test("switching to one total includes adjustments exactly once", () => {
  const state: ExpenseState = { stage: "receipt", name: "Dinner", people, mode: "itemized", items: [item("a", 100)], globalAdjustments: global, date: "2026-09-11", currency: "USD" };
  const simple = expenseReducer(state, { type: "SET_MODE", mode: "simple" });
  expect(simple.globalAdjustments).toBeUndefined();
  expect(computeSplit(simple.people, simple.items).grandTotal).toBe(117);
});
