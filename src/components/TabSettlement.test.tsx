// @vitest-environment happy-dom
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { renderMarkup } from "@/test/render";

const mocks = vi.hoisted(() => ({ results: [] as unknown[], query: vi.fn() }));
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => {
    mocks.query(...args);
    return mocks.results.shift();
  },
}));
vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  return {
    Link: ({ children, params }: { children: React.ReactNode; params: { slug: string } }) =>
      React.createElement("a", { href: `/e/${params.slug}` }, children),
  };
});

import { SettlementSummary, TabSettlement, type SettlementSummaryData } from "./TabSettlement";

afterEach(() => {
  mocks.results = [];
  mocks.query.mockClear();
});

const data: SettlementSummaryData = {
  viewerMemberId: "viewer",
  missingPayers: [],
  currencies: [
    {
      currency: "CAD",
      members: [
        { memberId: "viewer", name: "Nikki Q", balance: 840.11 },
        {
          memberId: "p2",
          name: "P2",
          balance: -1674.33,
          balanceWithViewer: 1674.33,
          hasSharedExpenseWithViewer: true,
        },
        {
          memberId: "alex",
          name: "Alex",
          balance: 0,
          balanceWithViewer: -842.55,
          hasSharedExpenseWithViewer: true,
        },
        {
          memberId: "p3",
          name: "P3",
          balance: -9,
          balanceWithViewer: 0,
          hasSharedExpenseWithViewer: true,
        },
        {
          memberId: "unrelated",
          name: "Payment only",
          balance: 2,
          balanceWithViewer: 2,
          hasSharedExpenseWithViewer: false,
        },
      ],
    },
    {
      currency: "USD",
      members: [
        { memberId: "viewer", name: "Nikki Q", balance: 361.2 },
        {
          memberId: "jamie",
          name: "Jamie",
          balance: 486.2,
          balanceWithViewer: 486.2,
          hasSharedExpenseWithViewer: true,
        },
        {
          memberId: "sam",
          name: "Sam",
          balance: -125,
          balanceWithViewer: -125,
          hasSharedExpenseWithViewer: true,
        },
      ],
    },
  ],
};

test("shows per-currency direct owed and owing totals with viewer-centric rows", () => {
  const markup = renderMarkup(createElement(SettlementSummary, { data, viewerName: "Nikki Q" }));
  expect(markup).toContain("Nikki Q");
  expect(markup).toContain("You are owed");
  expect(markup).toContain("You owe");
  expect(markup).toContain("P2 owes you");
  expect(markup).toContain("You owe Alex");
  expect(markup).toContain("Settled with P3");
  expect(markup).toContain('aria-label="Settled"');
  expect(markup).toContain("Payment only owes you");
  expect(markup).toContain('aria-label="CAD balances"');
  expect(markup).toContain('aria-label="USD balances"');
});

test("opens a member's detail from the whole balance row", () => {
  const onMemberClick = vi.fn();
  const container = document.createElement("div");
  const root = createRoot(container);
  flushSync(() => root.render(createElement(SettlementSummary, { data, onMemberClick })));
  container
    .querySelector<HTMLButtonElement>('button[aria-label="View P2\'s CAD expenses"]')
    ?.click();
  expect(onMemberClick).toHaveBeenCalledWith("p2", "CAD");
  root.unmount();
});

test("lets tab members open expenses that need a payer", () => {
  const markup = renderMarkup(
    createElement(SettlementSummary, {
      data: { ...data, missingPayers: [{ slug: "needs-payer", name: "Dinner" }] },
      canManage: true,
    }),
  );
  expect(markup).toContain('href="/e/needs-payer"');
  expect(markup).toContain("Dinner");
});

test("keeps the selected expense view and removes payment and breakdown controls", () => {
  mocks.results = [
    { paid: data, upcoming: data, all: data },
    { currencies: [], expenseCount: 0, tab: { name: "Trip", slug: "trip" } },
  ];
  const markup = renderMarkup(
    createElement(TabSettlement, {
      slug: "trip",
      members: [{ id: "viewer", name: "Nikki Q" }],
      canManage: true,
      expenseView: "upcoming",
    }),
  );
  expect(mocks.query).toHaveBeenCalledTimes(2);
  expect(mocks.query.mock.calls[0]?.[1]).toMatchObject({ slug: "trip" });
  expect(mocks.query.mock.calls[1]?.[1]).toMatchObject({ slug: "trip", view: "upcoming" });
  expect(markup).not.toContain("View payments");
  expect(markup).not.toContain("Breakdown</a>");
});
