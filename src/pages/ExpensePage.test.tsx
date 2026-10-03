// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  viewer: { _id: "viewer", defaultCurrency: "USD" } as unknown,
  tab: undefined as unknown,
  stored: null as unknown,
  loading: false,
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useQuery: () => mocks.viewer,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => createElement("a", null, children),
  getRouteApi: () => ({
    useParams: () => ({ slug: "new-expense" }),
    useSearch: () => ({ count: "1", tab: "trip" }),
  }),
  useNavigate: () => vi.fn(),
}));
vi.mock("@/lib/tabSync", () => ({
  useTab: () => mocks.tab,
  useTabList: () => [],
  useTabActions: () => ({ createExpense: vi.fn() }),
}));
vi.mock("@/lib/expenseSync", () => ({
  useStoredExpense: () => ({ state: mocks.stored, loading: mocks.loading }),
  useExpenseActions: () => ({ save: vi.fn(), remove: vi.fn() }),
  useUploadExpenseImage: () => vi.fn(),
  toExpenseStateArgs: () => ({}),
}));
vi.mock("@/components/StageExpense", () => ({
  StageExpense: ({ currency }: { currency: string }) =>
    createElement("div", { "data-testid": "expense-form" }, currency),
}));

import { ExpensePage } from "./ExpensePage";

afterEach(() => {
  mocks.tab = undefined;
  mocks.stored = null;
  mocks.loading = false;
  document.body.replaceChildren();
});

test("keeps the new expense skeleton until the tab's default currency is applied", async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(createElement(ExpensePage)));
  expect(container.querySelector('[role="status"]')?.textContent).toContain("Loading expense");
  expect(container.querySelector('[data-testid="expense-form"]')).toBeNull();

  mocks.tab = { slug: "trip", name: "Trip", defaultCurrency: "CAD", members: [] };
  await act(async () => root.render(createElement(ExpensePage)));
  expect(container.querySelector('[data-testid="expense-form"]')?.textContent).toBe("CAD");
  root.unmount();
});

test("shows the same skeleton while a saved expense loads", async () => {
  mocks.loading = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(createElement(ExpensePage)));
  expect(container.querySelector('[role="status"]')?.textContent).toContain("Loading expense");
  expect(container.querySelector('[data-testid="expense-form"]')).toBeNull();

  mocks.loading = false;
  mocks.stored = {
    stage: "receipt",
    name: "Dinner",
    people: [{ id: "p1", name: "Alex" }],
    mode: "simple",
    items: [],
    date: "2026-10-03",
    currency: "EUR",
  };
  await act(async () => root.render(createElement(ExpensePage)));
  expect(container.querySelector('[data-testid="expense-form"]')?.textContent).toBe("EUR");
  root.unmount();
});
