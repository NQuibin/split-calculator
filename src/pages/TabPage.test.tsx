// @vitest-environment happy-dom
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tab: undefined as unknown,
  queryResults: [] as unknown[],
  queryIndex: 0,
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useQuery: () => mocks.queryResults[mocks.queryIndex++],
  useMutation: () => vi.fn(async () => undefined),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
    createElement("a", { href: to }, children),
  getRouteApi: () => ({ useParams: () => ({ slug: "trip" }), useSearch: () => ({}) }),
  useNavigate: () => vi.fn(),
}));
vi.mock("@/lib/tabSync", () => ({
  useTab: () => {
    mocks.queryIndex = 0;
    return mocks.tab;
  },
  useTabActions: () => ({ claimMember: vi.fn(), deleteTab: vi.fn() }),
  useTabInviteLinks: () => [],
}));
vi.mock("@/lib/expenseSync", () => ({ useExpenseActions: () => ({ remove: vi.fn() }) }));
vi.mock("@/components/TabSettlement", () => ({
  TabSettlement: () => createElement("div", null, "Loaded settlement content"),
  SettlementActions: () => null,
}));

import { TabPage } from "./TabPage";

afterEach(() => {
  mocks.tab = undefined;
  mocks.queryResults = [];
  mocks.queryIndex = 0;
  document.body.replaceChildren();
});

test("skeletonizes the whole breadcrumb and withholds both data sections until all queries resolve", () => {
  const expenses: unknown[] = [];
  mocks.queryResults = [expenses, undefined, undefined];

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => root.render(createElement(TabPage)));

  const loadingCrumb = container.querySelector('nav[aria-label="Breadcrumb"] .bg-chip-neutral');
  expect(loadingCrumb?.classList.contains("h-5")).toBe(true);
  expect(loadingCrumb?.classList.contains("w-40")).toBe(true);
  expect(container.querySelectorAll('nav[aria-label="Breadcrumb"] li')).toHaveLength(1);
  expect(container.querySelector('nav[aria-label="Breadcrumb"]')?.textContent).not.toContain(
    "Tabs",
  );
  expect(container.textContent).not.toContain("Loaded settlement content");
  expect(container.textContent).not.toContain("No expenses yet");

  mocks.tab = {
    name: "Trip",
    slug: "trip",
    members: [],
    defaultCurrency: "CAD",
    isOwner: false,
    ownerName: "Nikki",
  };
  mocks.queryResults = [undefined, { _id: "viewer" }, { paid: {}, upcoming: {}, all: {} }];
  flushSync(() => root.render(createElement(TabPage)));
  expect(container.textContent).not.toContain("Loaded settlement content");
  expect(container.textContent).not.toContain("No expenses yet");

  mocks.queryResults = [expenses, { _id: "viewer" }, undefined];
  flushSync(() => root.render(createElement(TabPage)));
  expect(container.querySelector('nav[aria-label="Breadcrumb"]')?.textContent).toContain("Trip");
  expect(container.textContent).not.toContain("Loaded settlement content");
  expect(container.textContent).not.toContain("No expenses yet");

  mocks.queryResults = [expenses, { _id: "viewer" }, { paid: {}, upcoming: {}, all: {} }];
  flushSync(() => root.render(createElement(TabPage)));
  expect(container.textContent).toContain("Loaded settlement content");
  expect(container.textContent).toContain("No expenses yet");
  root.unmount();
});
