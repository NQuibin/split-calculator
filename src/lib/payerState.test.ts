import { expect, test } from "vitest";
import { expenseReducer } from "./reducer";
import { withTabPeople } from "./expenseDraft";
import { decodeSharePayload, encodeSharePayload } from "./shareLink";
import type { ExpenseState } from "./types";

const zero = { mode: "percent" as const, value: 0 };
const state: ExpenseState = {
  stage: "receipt", name: "Dinner", mode: "simple", date: "2026-09-12", currency: "CAD",
  people: [{ id: "alex", name: "Alex" }, { id: "sam", name: "Sam" }],
  payerId: "alex",
  items: [{ id: "dinner", name: "Dinner", cost: 120, discount: zero, tax: zero, tip: zero, splitWith: ["sam"] }],
};

test("selecting a payer does not add them to a split or change the expense", () => {
  const changed = expenseReducer(state, { type: "SET_PAYER", payerId: "sam" });
  expect(changed.payerId).toBe("sam");
  expect(changed.items).toEqual(state.items);
  expect(expenseReducer(state, { type: "SET_PAYER", payerId: "outsider" }).payerId).toBeUndefined();
});

test("removing a guest payer clears the payer but renaming and mode changes retain it", () => {
  expect(expenseReducer(state, { type: "REMOVE_PERSON", id: "alex" }).payerId).toBeUndefined();
  expect(expenseReducer(state, { type: "RENAME_PERSON", id: "alex", name: "Alexandra" }).payerId).toBe("alex");
  expect(expenseReducer(state, { type: "SET_MODE", mode: "itemized" }).payerId).toBe("alex");
});

test("tab roster refresh retains valid payer IDs and clears IDs from another tab", () => {
  expect(withTabPeople(state, [...state.people, { id: "lee", name: "Lee" }]).payerId).toBe("alex");
  expect(withTabPeople(state, [{ id: "other-alex", name: "Alex" }]).payerId).toBeUndefined();
});

test("share links preserve payer identity; older links keep it unspecified", () => {
  const payload = { slug: "dinner", people: state.people, items: state.items, payerId: state.payerId, currency: state.currency };
  expect(decodeSharePayload(encodeSharePayload(payload))).toEqual(payload);
  expect(decodeSharePayload(encodeSharePayload({ ...payload, payerId: undefined }))?.payerId).toBeUndefined();
});
