// @vitest-environment happy-dom
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { renderMarkup } from "@/test/render";
import type { TabExpenseSummary } from "@/lib/tabSync";
import { ExpenseViewTabs } from "@/components/ExpenseViewTabs";

const mocks = vi.hoisted(() => ({
  results: [] as unknown[],
  query: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => {
    mocks.query(...args);
    return mocks.results.shift();
  },
}));
vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  return {
    Link: ({
      children,
      params,
      to,
      search,
      className,
    }: {
      children: React.ReactNode;
      params: { slug: string };
      to: string;
      search?: { view?: string };
      className?: string;
    }) =>
      React.createElement(
        "a",
        {
          href:
            to === "/e/$slug"
              ? `/e/${params.slug}`
              : `/t/${params.slug}/payment${search?.view ? `?view=${search.view}` : ""}`,
          className,
        },
        children,
      ),
  };
});

import {
  SettlementActions,
  SettlementSummary,
  TabSettlement,
  type SettlementSummaryData,
} from "./TabSettlement";

afterEach(() => {
  mocks.results = [];
  mocks.query.mockClear();
  document.body.replaceChildren();
});

const data: SettlementSummaryData = {
  viewerMemberId: "viewer",
  missingPayers: [],
  history: [],
  currencies: [
    {
      currency: "CAD",
      members: [
        { memberId: "viewer", name: "Nikki Q", balance: 840.11, expenses: [] },
        {
          memberId: "p2",
          name: "P2",
          balance: -1674.33,
          balanceWithViewer: 1674.33,
          expenses: [
            {
              expenseId: "e1",
              expenseSlug: "first",
              name: "First expense",
              date: "2026-09-01",
              outstanding: 30,
            },
            {
              expenseId: "e2",
              expenseSlug: "second",
              name: "Second expense",
              date: "2026-09-02",
              outstanding: 30,
            },
          ],
        },
        {
          memberId: "alex",
          name: "Alex",
          balance: 0,
          balanceWithViewer: -842.55,
          expenses: [],
        },
        {
          memberId: "p3",
          name: "P3",
          balance: -9,
          balanceWithViewer: 0,
          expenses: [],
        },
        {
          memberId: "unrelated",
          name: "Payment only",
          balance: 2,
          balanceWithViewer: 2,
          expenses: [],
        },
      ],
    },
    {
      currency: "USD",
      members: [
        { memberId: "viewer", name: "Nikki Q", balance: 361.2, expenses: [] },
        {
          memberId: "jamie",
          name: "Jamie",
          balance: 486.2,
          balanceWithViewer: 486.2,
          expenses: [],
        },
        {
          memberId: "sam",
          name: "Sam",
          balance: -125,
          balanceWithViewer: -125,
          expenses: [],
        },
      ],
    },
  ],
};

const zero = { mode: "percent" as const, value: 0 };
const thirdPartyExpense: TabExpenseSummary = {
  mode: "simple",
  date: "2026-09-08",
  createdBy: { id: "third", name: "Third payer" },
  slug: "third-party",
  name: "Third-party expense",
  payerId: "third",
  people: [
    { id: "viewer", name: "Nikki Q" },
    { id: "p3", name: "P3" },
    { id: "third", name: "Third payer" },
  ],
  items: [
    {
      id: "total",
      name: "Total",
      cost: 30,
      discount: zero,
      tax: zero,
      tip: zero,
      splitWith: ["viewer", "p3", "third"],
    },
  ],
  currency: "CAD",
  settlementCurrency: "CAD",
  createdAt: 0,
};

test("shows per-currency direct owed and owing totals with viewer-centric rows", () => {
  const markup = renderMarkup(
    createElement(SettlementSummary, {
      data,
      viewerName: "Nikki Q",
      expenses: [thirdPartyExpense],
    }),
  );
  expect(markup).toContain("Nikki Q");
  expect(markup).toContain("You are owed");
  expect(markup).toContain("You owe");
  expect(markup).toContain('class="font-medium">P2</span> owes you');
  expect(markup).toContain('You owe <span class="font-medium">Alex</span>');
  expect(markup).not.toContain("P3");
  expect(markup).not.toContain("1 expense");
  expect(markup).toContain("chevron-x");
  expect(markup).toContain("-mr-1");
  expect(markup).toContain('class="font-medium">Payment only</span> owes you');
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

test("omits a zero-balance member row", () => {
  const settledData: SettlementSummaryData = {
    viewerMemberId: "viewer",
    missingPayers: [],
    history: [],
    currencies: [
      {
        currency: "CAD",
        members: [data.currencies[0].members[0], data.currencies[0].members[3]],
      },
    ],
  };
  const markup = renderMarkup(createElement(SettlementSummary, { data: settledData }));

  expect(markup).toContain("No outstanding balances.");
  expect(markup).not.toContain("P3");
  expect(markup).not.toContain('aria-label="View');
  expect(markup).not.toContain("chevron-x");
});

test("hides zero-value owed and owe summaries", () => {
  const oneDirection: SettlementSummaryData = {
    viewerMemberId: "viewer",
    missingPayers: [],
    history: [],
    currencies: [
      {
        currency: "CAD",
        members: [
          { memberId: "viewer", name: "Nikki Q", balance: 30, expenses: [] },
          {
            memberId: "p2",
            name: "P2",
            balance: -30,
            balanceWithViewer: 30,
            expenses: [],
          },
        ],
      },
    ],
  };

  const owed = renderMarkup(createElement(SettlementSummary, { data: oneDirection }));
  const owing = renderMarkup(
    createElement(SettlementSummary, {
      data: {
        ...oneDirection,
        currencies: [
          {
            currency: "CAD",
            members: [
              { memberId: "viewer", name: "Nikki Q", balance: -30, expenses: [] },
              {
                memberId: "p2",
                name: "P2",
                balance: 30,
                balanceWithViewer: -30,
                expenses: [],
              },
            ],
          },
        ],
      },
    }),
  );

  expect(owed).toContain("You are owed");
  expect(owed).not.toContain("You owe</span>");
  expect(owing).toContain("You owe</span>");
  expect(owing).not.toContain("You are owed");
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

test("shows the selected member balance above the modal expense list", () => {
  const response = { paid: data, upcoming: data, all: data };
  const breakdownResult = {
    currencies: [
      {
        currency: "CAD",
        expenseCount: 0,
        convertedExpenseCount: 0,
        members: [
          {
            memberId: "p2",
            resolvedId: "p2",
            name: "P2",
            claimed: false,
            totalSpent: 0,
            expenseCount: 0,
            expenses: [],
          },
        ],
      },
    ],
    expenseCount: 0,
    tab: { name: "Trip", slug: "trip" },
  };
  mocks.results = [response, breakdownResult, response, breakdownResult];
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() =>
    root.render(
      createElement(TabSettlement, {
        slug: "trip",
        members: [{ id: "viewer", name: "Nikki Q" }],
        canManage: true,
      }),
    ),
  );
  flushSync(() =>
    container
      .querySelector<HTMLButtonElement>('button[aria-label="View P2\'s CAD expenses"]')
      ?.click(),
  );

  expect(document.body.textContent).toContain("You are owed");
  expect(document.body.textContent).toContain("CA$1,674.33");
  root.unmount();
  container.remove();
});

test("links to record payment beside payment history and keeps the active view", () => {
  mocks.results = [{ paid: data, upcoming: data, all: data }];
  const markup = renderMarkup(
    createElement(SettlementActions, {
      slug: "trip",
      members: [{ id: "viewer", name: "Nikki Q" }],
      expenseView: "all",
    }),
  );
  expect(markup).toContain('href="/t/trip/payment?view=all"');
  expect(markup).toContain("Payment history");
  expect(markup.match(/min-w-0 w-full md:w-auto/g)).toHaveLength(2);
  expect(markup.match(/<svg/g)).toHaveLength(2);
});

test("places actions above view controls on mobile and beside them on desktop", () => {
  const markup = renderMarkup(
    <ExpenseViewTabs
      value="paid"
      onChange={() => undefined}
      label="Expense view"
      actions={<span>Actions</span>}
    >
      <span>Content</span>
    </ExpenseViewTabs>,
  );
  expect(markup).toContain("flex flex-col md:flex-row md:items-start md:justify-between md:gap-3");
  expect(markup).toContain("order-2 mb-6");
  expect(markup).toContain('class="order-1 md:order-none"');
});

test("hides record payment in the upcoming view", () => {
  mocks.results = [{ paid: data, upcoming: data, all: data }];
  const markup = renderMarkup(
    createElement(SettlementActions, {
      slug: "trip",
      members: [{ id: "viewer", name: "Nikki Q" }],
      expenseView: "upcoming",
    }),
  );
  expect(markup).not.toContain("Record payment");
  expect(markup).toContain("Payment history");
});

test("keeps payment history in its modal", () => {
  const historyData: SettlementSummaryData = {
    ...data,
    history: [
      {
        id: "payment-1",
        fromMemberId: "p2",
        toMemberId: "viewer",
        amount: 30,
        currency: "CAD",
        date: "2026-09-04",
        reversed: false,
        view: "paid",
      },
      {
        id: "payment-2",
        fromMemberId: "viewer",
        toMemberId: "p2",
        amount: 10,
        currency: "CAD",
        date: "2026-09-05",
        reversed: true,
        view: "upcoming",
      },
    ],
  };
  const response = { paid: historyData, upcoming: historyData, all: historyData };
  mocks.results = Array.from({ length: 5 }, () => response);
  const container = document.createElement("div");
  const root = createRoot(container);
  flushSync(() =>
    root.render(
      createElement(SettlementActions, {
        slug: "trip",
        members: [
          { id: "viewer", name: "Nikki Q" },
          { id: "p2", name: "P2" },
        ],
        expenseView: "paid",
      }),
    ),
  );
  const historyButton = [...container.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("Payment history"),
  );
  flushSync(() => historyButton?.click());
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog?.textContent).toContain("P2 paid Nikki Q");
  expect(dialog?.textContent).toContain("Nikki Q paid P2");
  expect(dialog?.textContent).toContain("CA$30.00");
  expect(dialog?.textContent).toContain("Upcoming expenses · Reversed");
  root.unmount();
});
