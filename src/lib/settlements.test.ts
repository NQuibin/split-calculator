import { expect, test } from "vitest";
import { computeSplit } from "./calculations";
import {
  computeExpenseBalances,
  splitParticipants,
  suggestSettlements,
  viewerBalanceLabel,
} from "./settlements";

test("viewer balance copy follows the viewer's net balance", () => {
  expect(viewerBalanceLabel(-12)).toBe("You owe");
  expect(viewerBalanceLabel(12)).toBe("You get");
});

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

test("splitParticipants drops a candidate with no items assigned to them", () => {
  // Mirrors the "Hmmm" expense: Nikki Q and P2 split the one item; P3 was
  // added to the tab and to this expense's people, but never assigned to
  // anything, so they neither owe nor get money back on it.
  const people = [
    { id: "nq", name: "Nikki Q" },
    { id: "p2", name: "P2" },
    { id: "p3", name: "P3" },
  ];
  const split = computeSplit(people, [item("thing", 20, ["nq", "p2"])]);
  const balances = computeExpenseBalances(people, split, "p2");
  expect(splitParticipants(people, balances).map((p) => p.name)).toEqual(["Nikki Q", "P2"]);
});

test("splitParticipants falls back to every candidate when there's no payer yet", () => {
  const people = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
  ];
  const split = computeSplit(people, [item("x", 10, ["a", "b"])]);
  expect(splitParticipants(people, computeExpenseBalances(people, split))).toEqual(people);
});
