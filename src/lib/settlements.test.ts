import { expect, test } from "vitest";
import { computeSplit } from "./calculations";
import { computeExpenseBalances, suggestSettlements } from "./settlements";

const zero = { mode: "amount" as const, value: 0 };
const item = (id: string, cost: number, splitWith: string[]) => ({
  id,
  name: id,
  cost,
  splitWith,
  discount: zero,
  tax: zero,
  tip: zero,
});

test("a $120 receipt split 40/40/40 leaves two $40 payments to its payer", () => {
  const people = ["a", "b", "c"].map((id) => ({ id, name: id }));
  const split = computeSplit(people, [item("receipt", 120, ["a", "b", "c"])]);
  const balances = computeExpenseBalances(people, split, "a");
  expect(balances.map((row) => row.balance)).toEqual([80, -40, -40]);
  expect(suggestSettlements(balances)).toEqual([
    { fromMemberId: "b", toMemberId: "a", amount: 40 },
    { fromMemberId: "c", toMemberId: "a", amount: 40 },
  ]);
});

test("itemized 45/45/30 assigns the payer independently of the split", () => {
  const people = ["a", "b", "c"].map((id) => ({ id, name: id }));
  const split = computeSplit(people, [
    item("a", 45, ["a"]),
    item("b", 45, ["b"]),
    item("c", 30, ["c"]),
  ]);
  const balances = computeExpenseBalances(people, split, "c");
  expect(balances.map((row) => row.balance)).toEqual([-45, -45, 90]);
  expect(suggestSettlements(balances)).toEqual([
    { fromMemberId: "a", toMemberId: "c", amount: 45 },
    { fromMemberId: "b", toMemberId: "c", amount: 45 },
  ]);
});

test("missing and foreign payers create no invented balances", () => {
  const people = [{ id: "a", name: "A" }];
  const split = computeSplit(people, [item("x", 10, ["a"])]);
  expect(computeExpenseBalances(people, split)).toEqual([]);
  expect(computeExpenseBalances(people, split, "elsewhere")).toEqual([]);
});
