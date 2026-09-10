// @vitest-environment node
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import { toExpenseStateArgs, useExpenseActions, useExpenseList } from "./expenseSync";

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: false, isLoading: false },
  remote: undefined as unknown,
  mutation: vi.fn(),
  save: vi.fn(), remove: vi.fn(),
  local: [{ slug: "guest", state: { name: "Guest dinner" } }],
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => mocks.auth,
  useQuery: () => mocks.remote,
  useMutation: () => mocks.mutation,
}));
vi.mock("./storage", () => ({
  saveExpense: mocks.save, deleteExpense: mocks.remove,
  getExpenseListServerSnapshot: () => mocks.local,
  getExpenseListSnapshot: () => mocks.local,
  subscribeExpenseList: () => () => {},
}));
afterEach(() => { vi.clearAllMocks(); mocks.auth = { isAuthenticated: false, isLoading: false }; mocks.remote = undefined; });
function renderHook<T>(hook: () => T): T {
  let result: T;
  function Probe() { result = hook(); return null; }
  renderToStaticMarkup(createElement(Probe));
  return result!;
}
const state = { stage: "receipt" as const, name: "Dinner", people: [], mode: "simple" as const, items: [], contributions: [], date: "2026-09-07", currency: "USD" };

test("guest writes and deletes stay local", async () => {
  const actions = renderHook(useExpenseActions);
  await actions.save("guest", state);
  actions.remove("guest");
  expect(mocks.save).toHaveBeenCalledWith("guest", state);
  expect(mocks.remove).toHaveBeenCalledWith("guest");
  expect(mocks.mutation).not.toHaveBeenCalled();
});
test("signed-in writes and deletes never modify guest storage", async () => {
  mocks.auth.isAuthenticated = true;
  const actions = renderHook(useExpenseActions);
  await actions.save("account", state);
  actions.remove("account");
  expect(mocks.mutation).toHaveBeenCalledTimes(2);
  expect(mocks.save).not.toHaveBeenCalled();
  expect(mocks.remove).not.toHaveBeenCalled();
});
test("local expenses are hidden during login and while account data loads", () => {
  expect(renderHook(useExpenseList)).toEqual(mocks.local);
  mocks.auth.isLoading = true;
  expect(renderHook(useExpenseList)).toEqual([]);
  mocks.auth = { isAuthenticated: true, isLoading: false };
  expect(renderHook(useExpenseList)).toEqual([]);
  mocks.remote = [{ slug: "account" }];
  expect(renderHook(useExpenseList)).toEqual(mocks.remote);
  mocks.auth.isAuthenticated = false;
  expect(renderHook(useExpenseList)).toEqual(mocks.local);
});


test("editor stage is never included in a saved expense", () => {
  expect(toExpenseStateArgs(state)).not.toHaveProperty("stage");
  expect(toExpenseStateArgs({ ...state, stage: "results" })).toEqual(toExpenseStateArgs(state));
});
