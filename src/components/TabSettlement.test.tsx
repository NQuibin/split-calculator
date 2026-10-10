// @vitest-environment happy-dom
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { renderMarkup } from "@/test/render";
import type { TabExpenseSummary } from "@/lib/tabSync";

const mocks = vi.hoisted(() => ({
  results: [] as unknown[],
  query: vi.fn(),
  reverse: vi.fn().mockResolvedValue(null),
}));
vi.mock("convex/react", () => ({
  useMutation: () => mocks.reverse,
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
      search?: { view?: string; memberId?: string; currency?: string };
      className?: string;
    }) =>
      React.createElement(
        "a",
        {
          href:
            to === "/e/$slug"
              ? `/e/${params.slug}`
              : `/t/${params.slug}/payment?${new URLSearchParams(
                  Object.entries(search ?? {}).filter(
                    (entry): entry is [string, string] => typeof entry[1] === "string",
                  ),
                )}`,
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
  type TabSettlementResponse,
} from "./TabSettlement";

afterEach(() => {
  mocks.results = [];
  mocks.query.mockClear();
  mocks.reverse.mockClear();
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
  const response = { paid: data, upcoming: data, all: data } as unknown as TabSettlementResponse;
  mocks.results = [{ currencies: [], expenseCount: 0, tab: { name: "Trip", slug: "trip" } }];
  const markup = renderMarkup(
    createElement(TabSettlement, {
      slug: "trip",
      members: [{ id: "viewer", name: "Nikki Q" }],
      canManage: true,
      expenseView: "upcoming",
      asOfDate: "2026-10-03",
      response,
    }),
  );
  expect(mocks.query).toHaveBeenCalledTimes(1);
  expect(mocks.query.mock.calls[0]?.[1]).toMatchObject({
    slug: "trip",
    view: "upcoming",
    asOfDate: "2026-10-03",
  });
  expect(markup).not.toContain("View payments");
  expect(markup).not.toContain("Breakdown</a>");
});

test("shows the selected member balance above the modal expense list", () => {
  const response = { paid: data, upcoming: data, all: data } as unknown as TabSettlementResponse;
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
  mocks.results = [breakdownResult, breakdownResult];
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() =>
    root.render(
      createElement(TabSettlement, {
        slug: "trip",
        members: [{ id: "viewer", name: "Nikki Q" }],
        canManage: true,
        asOfDate: "2026-10-03",
        response,
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
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog?.querySelector('[data-slot="dialog-description"]')?.textContent).toBe("0 expenses");
  expect(dialog?.querySelector("span.bg-chip-neutral")?.textContent).toBe("CAD");
  expect(
    dialog?.querySelector('a[href="/t/trip/payment?view=paid&memberId=p2&currency=CAD"]'),
  ).not.toBeNull();
  expect(dialog?.querySelector("footer a")?.className).toContain("w-full sm:w-auto");
  root.unmount();
  container.remove();
});

test("returns from an expense to its member balance modal", () => {
  const response = { paid: data, upcoming: data, all: data } as unknown as TabSettlementResponse;
  const breakdownResult = {
    currencies: [
      {
        currency: "CAD",
        expenseCount: 1,
        convertedExpenseCount: 0,
        members: [
          {
            memberId: "p2",
            resolvedId: "p2",
            name: "P2",
            claimed: false,
            totalSpent: 0,
            expenseCount: 1,
            expenses: [
              {
                expenseSlug: "first",
                expenseName: "First expense",
                date: "2026-09-01",
                fairShare: 15,
                balance: -15,
                viewerBalance: 15,
                sharedWithViewer: true,
                payerId: "viewer",
                payerName: "Nikki Q",
                total: 30,
              },
            ],
          },
        ],
      },
    ],
    expenseCount: 1,
    tab: { name: "Trip", slug: "trip" },
  };
  mocks.results = Array.from({ length: 12 }, () => breakdownResult);
  const expense = {
    ...thirdPartyExpense,
    slug: "first",
    name: "First expense",
    payerId: "viewer",
    people: [
      { id: "viewer", name: "Nikki Q" },
      { id: "p2", name: "P2" },
    ],
    items: [{ ...thirdPartyExpense.items[0], splitWith: ["viewer", "p2"] }],
  };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const popupFor = (title: string) =>
    [...document.querySelectorAll<HTMLElement>('[data-slot="dialog-content"]')].find(
      (popup) => popup.querySelector('[data-slot="dialog-title"]')?.textContent === title,
    );
  flushSync(() =>
    root.render(
      createElement(TabSettlement, {
        slug: "trip",
        members: [
          { id: "viewer", name: "Nikki Q" },
          { id: "p2", name: "P2" },
        ],
        canManage: true,
        defaultCurrency: "CAD",
        expenses: [expense],
        asOfDate: "2026-10-03",
        response,
      }),
    ),
  );

  flushSync(() =>
    container
      .querySelector<HTMLButtonElement>('button[aria-label="View P2\'s CAD expenses"]')
      ?.click(),
  );
  expect(popupFor("P2")?.className).toContain("data-open:animate-in");
  flushSync(() =>
    [...document.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.includes("First expense"))
      ?.click(),
  );
  expect(document.querySelector('[aria-label="Back to balance"]')).not.toBeNull();
  expect(popupFor("First expense")?.className).toContain("data-open:animate-in");
  flushSync(() =>
    [...document.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.includes("Delete"))
      ?.click(),
  );
  expect(document.querySelector('[aria-label="Delete this expense?"]')).not.toBeNull();
  expect(document.querySelector('[aria-label="Delete this expense?"] strong')?.textContent).toBe(
    "First expense",
  );
  expect(document.body.textContent).toContain("Delete expense");
  flushSync(() =>
    [...document.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent === "Cancel")
      ?.click(),
  );

  flushSync(() =>
    document.querySelector<HTMLButtonElement>('[aria-label="Back to balance"]')?.click(),
  );
  expect(popupFor("First expense")?.hasAttribute("data-closed")).toBe(true);
  expect(popupFor("First expense")?.textContent).toContain("First expense");
  expect(popupFor("P2")?.hasAttribute("data-open")).toBe(true);
  expect(popupFor("P2")?.className).toContain("data-open:animate-in");
  root.unmount();
  container.remove();
});

test("opens payment management and keeps the active view on the record link", () => {
  mocks.results = Array.from({ length: 8 }, () => ({ paid: data, upcoming: data, all: data }));
  const container = document.createElement("div");
  const root = createRoot(container);
  flushSync(() =>
    root.render(
      createElement(SettlementActions, {
        slug: "trip",
        members: [{ id: "viewer", name: "Nikki Q" }],
        expenseView: "all",
      }),
    ),
  );
  expect(container.textContent).toContain("Manage payments");
  expect(container.textContent).not.toContain("Payment history");
  flushSync(() =>
    [...container.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Manage payments"))
      ?.click(),
  );
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog?.textContent).toContain("Record payment");
  expect(dialog?.textContent).toContain("View payment history");
  expect(dialog?.querySelector('a[href="/t/trip/payment?view=all"]')).not.toBeNull();
  root.unmount();
});

test("disables record payment in the upcoming view", () => {
  mocks.results = Array.from({ length: 8 }, () => ({ paid: data, upcoming: data, all: data }));
  const container = document.createElement("div");
  const root = createRoot(container);
  flushSync(() =>
    root.render(
      createElement(SettlementActions, {
        slug: "trip",
        members: [{ id: "viewer", name: "Nikki Q" }],
        expenseView: "upcoming",
      }),
    ),
  );
  flushSync(() =>
    [...container.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Manage payments"))
      ?.click(),
  );
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog?.querySelector("button[disabled]")?.textContent).toContain("Record payment");
  expect(dialog?.querySelector('a[href*="/payment"]')).toBeNull();
  expect(dialog?.textContent).toContain("View payment history");
  root.unmount();
});

test("adds top padding when payment history is empty", () => {
  const response = { paid: data, upcoming: data, all: data };
  mocks.results = Array.from({ length: 8 }, () => response);
  const container = document.createElement("div");
  const root = createRoot(container);
  flushSync(() =>
    root.render(
      createElement(SettlementActions, {
        slug: "trip",
        members: [{ id: "viewer", name: "Nikki Q" }],
        expenseView: "paid",
      }),
    ),
  );
  flushSync(() =>
    [...container.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Manage payments"))
      ?.click(),
  );
  flushSync(() =>
    [...document.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.includes("View payment history"))
      ?.click(),
  );
  const empty = [...document.querySelectorAll("p")].find(
    (paragraph) => paragraph.textContent === "No payments recorded.",
  );
  expect(empty?.classList.contains("pt-5")).toBe(true);
  expect(empty?.classList.contains("sm:pt-6")).toBe(true);
  root.unmount();
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
      {
        id: "payment-3",
        fromMemberId: "p2",
        toMemberId: "viewer",
        amount: 5,
        currency: "CAD",
        date: "2026-09-05",
        reversed: false,
        view: "paid",
      },
      {
        id: "payment-4",
        fromMemberId: "viewer",
        toMemberId: "p2",
        amount: 7,
        currency: "USD",
        date: "2026-09-05",
        reversed: false,
        view: "paid",
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
  const manageButton = [...container.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("Manage payments"),
  );
  flushSync(() => manageButton?.click());
  const manageDialog = document.querySelector('[role="dialog"]');
  flushSync(() =>
    [...document.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.includes("View payment history"))
      ?.click(),
  );
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog).not.toBe(manageDialog);
  expect(dialog?.className).toContain("animate-in");
  expect(dialog?.textContent).toContain("P2 → Nikki Q");
  expect(dialog?.textContent).toContain("Nikki Q → P2");
  expect(dialog?.textContent).toContain("CA$30.00");
  expect(dialog?.textContent).toContain("CA$5.00");
  expect(dialog?.textContent).toContain("$7.00");
  expect(dialog?.textContent).toContain("Upcoming expensesReversed");
  expect(dialog?.querySelectorAll('[role="img"][aria-label="P2"]')).toHaveLength(2);
  expect(dialog?.querySelectorAll('[role="img"][aria-label="Nikki Q"]')).toHaveLength(2);
  expect(dialog?.querySelectorAll(".min-w-0.text-left")).toHaveLength(8);
  expect(dialog?.querySelectorAll(".font-numeric.text-sm.font-semibold")).toHaveLength(4);
  expect(dialog?.querySelectorAll('button[aria-label^="Reverse "]')).toHaveLength(0);
  expect(dialog?.querySelector('[aria-label="Close payment history"]')).not.toBeNull();
  flushSync(() =>
    dialog?.querySelector<HTMLButtonElement>('[aria-label="Back to manage payments"]')?.click(),
  );
  const returnedDialog = document.querySelector('[role="dialog"]');
  expect(returnedDialog).not.toBe(dialog);
  expect(returnedDialog?.className).toContain("animate-in");
  expect(returnedDialog?.textContent).toContain("View payment history");
  flushSync(() =>
    [...document.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.includes("View payment history"))
      ?.click(),
  );
  const historyDialog = document.querySelector('[role="dialog"]');
  expect(historyDialog).not.toBe(returnedDialog);
  expect(historyDialog?.querySelectorAll("header")).toHaveLength(1);
  expect(historyDialog?.querySelectorAll('time[datetime="2026-09-04"]')).toHaveLength(1);
  expect(historyDialog?.querySelectorAll('time[datetime="2026-09-05"]')).toHaveLength(1);
  const sep5 = historyDialog?.querySelector('time[datetime="2026-09-05"]')?.closest("li");
  expect(sep5?.querySelectorAll(":scope > ul > li")).toHaveLength(2);
  expect(sep5?.querySelectorAll("span.rounded-full.border-rule.bg-chip-neutral")).toHaveLength(2);
  expect(sep5?.querySelector("ul.border-t.border-edge")).not.toBeNull();
  expect(sep5?.querySelector("ul.border-b.border-edge")).not.toBeNull();
  expect(sep5?.querySelector("ul.divide-y.divide-rule")).not.toBeNull();
  expect(historyDialog?.querySelector(".overflow-y-auto")).not.toBeNull();
  expect(historyDialog?.textContent).not.toContain("Done");
  root.unmount();
});

test("replaces payment history with details and confirms reversal", async () => {
  const historyData: SettlementSummaryData = {
    ...data,
    history: [
      {
        id: "reversal-1",
        fromMemberId: "viewer",
        toMemberId: "p2",
        amount: 1,
        currency: "CAD",
        date: "2026-10-01",
        reversed: false,
        reversalOf: "payment-1",
      },
      {
        id: "payment-1",
        fromMemberId: "p2",
        toMemberId: "viewer",
        amount: 1,
        currency: "CAD",
        date: "2026-09-30",
        reversed: true,
        reversedAt: Date.parse("2026-10-01T12:00:00Z"),
      },
      {
        id: "payment-2",
        fromMemberId: "p2",
        toMemberId: "viewer",
        amount: 2,
        currency: "CAD",
        date: "2026-09-30",
        reversed: false,
      },
    ],
  };
  const response = { paid: historyData, upcoming: historyData, all: historyData };
  mocks.results = Array.from({ length: 8 }, () => response);
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
  flushSync(() =>
    [...container.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Manage payments"))
      ?.click(),
  );
  flushSync(() =>
    [...document.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.includes("View payment history"))
      ?.click(),
  );
  const history = document.querySelector('[role="dialog"]');
  expect(history?.textContent).toContain("P2 → Nikki Q");
  expect(history?.querySelectorAll('button[aria-label^="Reverse "]')).toHaveLength(0);
  const originalRow = [
    ...(history?.querySelectorAll<HTMLButtonElement>('button[aria-label^="View payment"]') ?? []),
  ].find((button) => button.getAttribute("aria-label")?.includes("CA$2.00"));
  expect(originalRow).toBeDefined();
  flushSync(() => originalRow?.click());
  let details = document.querySelector<HTMLElement>('[role="dialog"]');
  expect(details).not.toBe(history);
  await vi.waitFor(() => expect(history?.isConnected).toBe(false));
  expect(details?.textContent).toContain("Payment details");
  expect(details?.textContent).toContain("paid Nikki Q");
  expect(details?.textContent).toContain("CA$2.00");
  expect(details?.querySelector("svg.lucide-calendar-days")).toBeNull();
  expect(details?.textContent).not.toContain("The original payment is kept in your history.");
  const activeFooter = details?.querySelector("footer");
  expect(activeFooter).not.toBeNull();
  expect(activeFooter?.querySelector('[aria-label="Reverse payment"]')).not.toBeNull();
  expect(activeFooter?.parentElement?.classList.contains("overflow-y-auto")).toBe(false);
  flushSync(() =>
    details?.querySelector<HTMLButtonElement>('button[aria-label="Reverse payment"]')?.click(),
  );
  const confirmDialog = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].find(
    (dialog) => dialog.textContent?.includes("Reverse this payment?"),
  );
  expect(confirmDialog).toBeDefined();
  expect(
    [...document.querySelectorAll<HTMLElement>('[role="dialog"][data-open]')].some((dialog) =>
      dialog.textContent?.includes("Payment history"),
    ),
  ).toBe(false);
  expect(confirmDialog?.querySelector("header, footer")).toBeNull();
  expect(confirmDialog?.textContent).toContain("Reverse this payment?");
  expect(confirmDialog?.textContent).toContain(
    "A reversal record will be added and balances updated.",
  );
  expect(confirmDialog?.querySelector("svg.lucide-calendar-days")).toBeNull();
  expect(confirmDialog?.textContent).not.toContain("The original payment is kept in your history.");
  const cancelButton = [
    ...(confirmDialog?.querySelectorAll<HTMLButtonElement>("button") ?? []),
  ].find((button) => button.textContent?.includes("Cancel"));
  expect(cancelButton).toBeDefined();
  mocks.reverse.mockRejectedValueOnce(new Error("Could not reverse payment."));
  const confirmButton = [
    ...(confirmDialog?.querySelectorAll<HTMLButtonElement>("button") ?? []),
  ].find((button) => button.textContent?.includes("Reverse payment"));
  flushSync(() => confirmButton?.click());
  await vi.waitFor(() =>
    expect(confirmDialog?.querySelector('[role="alert"]')?.textContent).toBe(
      "Could not reverse payment.",
    ),
  );
  expect(details?.hasAttribute("data-open")).toBe(true);
  flushSync(() => cancelButton?.click());
  await vi.waitFor(() => expect(confirmDialog?.hasAttribute("data-closed")).toBe(true));
  expect(details?.textContent).toContain("Payment details");

  details =
    [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].find((dialog) =>
      dialog.textContent?.includes("Payment details"),
    ) ?? null;
  flushSync(() =>
    details?.querySelector<HTMLButtonElement>('button[aria-label="Reverse payment"]')?.click(),
  );
  const reopenedConfirm = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].find(
    (dialog) => dialog.textContent?.includes("Reverse this payment?"),
  );
  expect(reopenedConfirm).toBeDefined();
  const reverseButton = [
    ...(reopenedConfirm?.querySelectorAll<HTMLButtonElement>("button") ?? []),
  ].find((button) => button.textContent?.includes("Reverse payment"));
  flushSync(() => reverseButton?.click());
  await vi.waitFor(() =>
    expect(mocks.reverse).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "trip", settlementId: "payment-2" }),
    ),
  );
  expect(details?.hasAttribute("data-open")).toBe(true);
  await vi.waitFor(() => expect(reopenedConfirm?.hasAttribute("data-closed")).toBe(true));
  const refreshedData: SettlementSummaryData = {
    ...historyData,
    history: historyData.history
      .map((payment) =>
        payment.id === "payment-2"
          ? { ...payment, reversed: true, reversedAt: Date.parse("2026-10-01T12:00:00Z") }
          : payment,
      )
      .concat({
        id: "reversal-2",
        fromMemberId: "viewer",
        toMemberId: "p2",
        amount: 2,
        currency: "CAD",
        date: "2026-10-01",
        createdAt: Date.parse("2026-10-01T12:00:00Z"),
        reversed: false,
        reversalOf: "payment-2",
      }),
  };
  const refreshed = { paid: refreshedData, upcoming: refreshedData, all: refreshedData };
  flushSync(() =>
    root.render(
      createElement(SettlementActions, {
        slug: "trip",
        members: [
          { id: "viewer", name: "Nikki Q" },
          { id: "p2", name: "P2" },
        ],
        expenseView: "paid",
        response: refreshed as unknown as TabSettlementResponse,
      }),
    ),
  );
  const refreshedDetails = document.querySelector<HTMLElement>('[role="dialog"]');
  expect(refreshedDetails?.textContent).toContain("Payment details");
  expect(refreshedDetails?.textContent).toContain("Payment reversed");
  expect(refreshedDetails?.querySelector('[aria-label="Reverse payment"]')).toBeNull();
  expect(refreshedDetails?.querySelector("footer")).toBeNull();
  expect(refreshedDetails?.textContent).not.toContain("Close");
  expect(document.activeElement).toBe(
    refreshedDetails?.querySelector('[aria-label="Close payment details"]'),
  );
  flushSync(() =>
    refreshedDetails
      ?.querySelector<HTMLButtonElement>('[aria-label="Close payment details"]')
      ?.click(),
  );
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"][data-open]')).toBeNull());
  root.unmount();
});

test("shows a linked reversal timeline and no reverse action for reversed payments", async () => {
  const historyData: SettlementSummaryData = {
    ...data,
    history: [
      {
        id: "reversal",
        fromMemberId: "viewer",
        toMemberId: "p2",
        amount: 5,
        currency: "CAD",
        date: "2026-10-01",
        createdAt: Date.parse("2026-10-01T12:00:00Z"),
        reversed: false,
        reversalOf: "original",
      },
      {
        id: "original",
        fromMemberId: "p2",
        toMemberId: "viewer",
        amount: 5,
        currency: "CAD",
        date: "2026-09-30",
        createdAt: Date.parse("2026-09-30T12:00:00Z"),
        reversed: true,
        reversedAt: Date.parse("2026-10-01T12:00:00Z"),
      },
    ],
  };
  const response = { paid: historyData, upcoming: historyData, all: historyData };
  mocks.results = Array.from({ length: 8 }, () => response);
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
  flushSync(() =>
    [...container.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Manage payments"))
      ?.click(),
  );
  flushSync(() =>
    [...document.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.includes("View payment history"))
      ?.click(),
  );
  const history = document.querySelector<HTMLElement>('[role="dialog"]');
  const originalRow = [
    ...(history?.querySelectorAll<HTMLButtonElement>('button[aria-label^="View payment"]') ?? []),
  ].find((button) => button.getAttribute("aria-label")?.includes("CA$5.00"));
  flushSync(() => originalRow?.click());
  const details = document.querySelector<HTMLElement>('[role="dialog"]');
  expect(details?.textContent).toContain("Reversed");
  expect(details?.textContent).toContain("Payment recorded");
  expect(details?.textContent).toContain("Payment reversed");
  expect(details?.textContent).toContain("+CA$5.00");
  expect(details?.textContent).toContain("−CA$5.00");
  expect(details?.querySelector('[aria-label="Reverse payment"]')).toBeNull();
  expect(details?.querySelector("footer")).toBeNull();
  expect(details?.textContent).not.toContain("Close");
  expect(details?.querySelector("svg.lucide-calendar-days")).toBeNull();
  expect(details?.textContent).not.toContain("The original payment is kept in your history.");
  expect(details?.querySelector('[aria-label="Close payment details"]')).not.toBeNull();
  const backToHistory = details?.querySelector<HTMLButtonElement>(
    '[aria-label="Back to payment history"]',
  );
  expect(backToHistory).not.toBeNull();
  flushSync(() => backToHistory?.click());
  const returnedHistory = document.querySelector<HTMLElement>('[role="dialog"]');
  expect(returnedHistory).not.toBe(details);
  expect(returnedHistory?.textContent).toContain("Payment history");
  const returnedOriginalRow = [
    ...(returnedHistory?.querySelectorAll<HTMLButtonElement>(
      'button[aria-label^="View payment"]',
    ) ?? []),
  ].find((button) => button.getAttribute("aria-label")?.includes("CA$5.00"));
  await vi.waitFor(() => expect(document.activeElement).toBe(returnedOriginalRow));
  const reversalRow = [
    ...(returnedHistory?.querySelectorAll<HTMLButtonElement>(
      'button[aria-label^="View reversal"]',
    ) ?? []),
  ][0];
  flushSync(() => reversalRow?.click());
  const reversalDetails = document.querySelector<HTMLElement>('[role="dialog"]');
  expect(reversalDetails?.textContent).toContain("Payment activity");
  flushSync(() => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"][data-open]')).toBeNull());
  root.unmount();
});

test("shows a reversal-only detail safely when its original is missing", () => {
  const missingOriginal: SettlementSummaryData = {
    ...data,
    history: [
      {
        id: "orphan-reversal",
        fromMemberId: "viewer",
        toMemberId: "p2",
        amount: 3,
        currency: "CAD",
        date: "2026-10-01",
        createdAt: Date.parse("2026-10-01T12:00:00Z"),
        reversed: false,
        reversalOf: "missing-payment",
      },
    ],
  };
  const response = { paid: missingOriginal, upcoming: missingOriginal, all: missingOriginal };
  mocks.results = Array.from({ length: 8 }, () => response);
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
  flushSync(() =>
    [...container.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.includes("Manage payments"))
      ?.click(),
  );
  flushSync(() =>
    [...document.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.includes("View payment history"))
      ?.click(),
  );
  const history = document.querySelector<HTMLElement>('[role="dialog"]');
  flushSync(() =>
    history?.querySelector<HTMLButtonElement>('button[aria-label^="View reversal"]')?.click(),
  );
  const details = document.querySelector<HTMLElement>('[role="dialog"]');
  expect(details?.textContent).toContain("Payment reversal to");
  expect(details?.textContent).toContain("−CA$3.00");
  expect(details?.textContent).toContain("The original payment is no longer available.");
  expect(details?.querySelector('[aria-label="Reverse payment"]')).toBeNull();
  root.unmount();
});
