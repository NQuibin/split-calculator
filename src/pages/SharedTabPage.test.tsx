// @vitest-environment happy-dom
import { act, createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticated: false,
  navigate: vi.fn(),
  getShareToken: vi.fn(async () => "share-secret"),
  loading: false,
  data: {
    tab: { slug: "trip", name: "Weekend getaway" },
    currencies: [
      {
        currency: "CAD",
        members: [
          {
            key: "member-0",
            name: "Alex",
            balance: 25,
            summaries: {
              paid: {
                totalShare: 25,
                totalCovered: 57.5,
                stillOwes: 0,
                stillOwed: 25,
                balances: [{ memberId: "member-1", balance: 25 }],
              },
              upcoming: {
                totalShare: 0,
                totalCovered: 0,
                stillOwes: 0,
                stillOwed: 0,
                balances: [{ memberId: "member-0", balance: 0 }],
              },
              all: {
                totalShare: 25,
                totalCovered: 57.5,
                stillOwes: 0,
                stillOwed: 25,
                balances: [{ memberId: "member-1", balance: 25 }],
              },
            },
            expenses: [
              {
                key: "dinner",
                name: "Dinner",
                date: "2026-10-02",
                createdAt: 0,
                paidAmount: 57.5,
                shareAmount: 25,
                total: 57.5,
                taxTotal: 5,
                tipTotal: 2.5,
                items: [{ key: "pasta", name: "Pasta", total: 50, share: 25 }],
              },
            ],
          },
          {
            key: "member-1",
            name: "Sam",
            balance: -25,
            summaries: {
              paid: {
                totalShare: 22,
                totalCovered: 0,
                stillOwes: 25,
                stillOwed: 0,
                balances: [{ memberId: "member-0", balance: -25 }],
              },
              upcoming: {
                totalShare: 0,
                totalCovered: 0,
                stillOwes: 0,
                stillOwed: 0,
                balances: [{ memberId: "member-0", balance: 0 }],
              },
              all: {
                totalShare: 22,
                totalCovered: 0,
                stillOwes: 25,
                stillOwed: 0,
                balances: [{ memberId: "member-0", balance: -25 }],
              },
            },
            expenses: [
              {
                key: "breakfast",
                name: "Breakfast",
                date: "2026-10-02",
                createdAt: 100,
                paidAmount: 0,
                shareAmount: 12,
                total: 24,
                taxTotal: 0,
                tipTotal: 0,
                items: [],
              },
              {
                key: "brunch",
                name: "Brunch",
                date: "2026-10-02",
                createdAt: 200,
                paidAmount: 0,
                shareAmount: 10,
                total: 20,
                taxTotal: 0,
                tipTotal: 0,
                items: [],
              },
            ],
          },
          {
            key: "member-2",
            name: "Pat",
            balance: 0,
            summaries: {
              paid: {
                totalShare: 22,
                totalCovered: 44,
                stillOwes: 0,
                stillOwed: 0,
                balances: [{ memberId: "member-0", balance: 0 }],
              },
              upcoming: {
                totalShare: 0,
                totalCovered: 0,
                stillOwes: 0,
                stillOwed: 0,
                balances: [{ memberId: "member-0", balance: 0 }],
              },
              all: {
                totalShare: 22,
                totalCovered: 44,
                stillOwes: 0,
                stillOwed: 0,
                balances: [{ memberId: "member-0", balance: 0 }],
              },
            },
            expenses: [
              {
                key: "breakfast",
                name: "Breakfast",
                date: "2026-10-02",
                createdAt: 100,
                paidAmount: 24,
                shareAmount: 12,
                total: 24,
                taxTotal: 0,
                tipTotal: 0,
                items: [],
              },
              {
                key: "brunch",
                name: "Brunch",
                date: "2026-10-02",
                createdAt: 200,
                paidAmount: 20,
                shareAmount: 10,
                total: 20,
                taxTotal: 0,
                tipTotal: 0,
                items: [],
              },
            ],
          },
        ],
        settlements: [{ from: "member-1", to: "member-0", amount: 25 }],
      },
      {
        currency: "USD",
        members: [
          {
            key: "member-0",
            name: "Alex",
            balance: 12,
            summaries: {
              paid: {
                totalShare: 0,
                totalCovered: 0,
                stillOwes: 0,
                stillOwed: 12,
                balances: [{ memberId: "member-1", balance: 12 }],
              },
              upcoming: {
                totalShare: 0,
                totalCovered: 0,
                stillOwes: 0,
                stillOwed: 0,
                balances: [{ memberId: "member-0", balance: 0 }],
              },
              all: {
                totalShare: 0,
                totalCovered: 0,
                stillOwes: 0,
                stillOwed: 12,
                balances: [{ memberId: "member-1", balance: 12 }],
              },
            },
            expenses: [],
          },
          {
            key: "member-1",
            name: "Sam",
            balance: -12,
            summaries: {
              paid: {
                totalShare: 0,
                totalCovered: 0,
                stillOwes: 12,
                stillOwed: 0,
                balances: [{ memberId: "member-0", balance: -12 }],
              },
              upcoming: {
                totalShare: 0,
                totalCovered: 0,
                stillOwes: 0,
                stillOwed: 0,
                balances: [{ memberId: "member-0", balance: 0 }],
              },
              all: {
                totalShare: 0,
                totalCovered: 0,
                stillOwes: 12,
                stillOwed: 0,
                balances: [{ memberId: "member-0", balance: -12 }],
              },
            },
            expenses: [],
          },
          {
            key: "member-2",
            name: "Pat",
            balance: 0,
            summaries: {
              paid: {
                totalShare: 0,
                totalCovered: 0,
                stillOwes: 0,
                stillOwed: 0,
                balances: [{ memberId: "member-0", balance: 0 }],
              },
              upcoming: {
                totalShare: 0,
                totalCovered: 0,
                stillOwes: 0,
                stillOwed: 0,
                balances: [{ memberId: "member-0", balance: 0 }],
              },
              all: {
                totalShare: 0,
                totalCovered: 0,
                stillOwes: 0,
                stillOwed: 0,
                balances: [{ memberId: "member-0", balance: 0 }],
              },
            },
            expenses: [],
          },
        ],
        settlements: [{ from: "member-1", to: "member-0", amount: 12 }],
      },
    ],
    expenseStatuses: [
      { expenseSlug: "dinner", memberId: "member-0", status: "partiallySettled" },
      { expenseSlug: "breakfast", memberId: "member-1", status: "settled" },
      { expenseSlug: "brunch", memberId: "member-1", status: "partiallySettled" },
      { expenseSlug: "dinner", memberId: "member-1", status: "outstanding" },
    ],
    history: [
      {
        key: "payment-1",
        from: "Sam",
        to: "Alex",
        fromMemberId: "member-1",
        toMemberId: "member-0",
        amount: 10,
        currency: "CAD",
        date: "2026-10-03",
        isReversal: false,
        reversed: false,
      },
    ],
  },
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: mocks.authenticated, isLoading: false }),
  useQuery: () => (mocks.loading ? undefined : mocks.data),
  useMutation: () => mocks.getShareToken,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) =>
    createElement("a", { href: to, ...props }, children),
  useNavigate: () => mocks.navigate,
}));

import { SharedTabPage } from "./SharedTabPage";

afterEach(() => {
  vi.useRealTimers();
  mocks.authenticated = false;
  mocks.loading = false;
  mocks.navigate.mockClear();
  mocks.getShareToken.mockClear();
  document.body.replaceChildren();
});

test("a member opens the page immediately, then the page adds its share token", async () => {
  mocks.authenticated = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(SharedTabPage, { slug: "trip", view: "breakdown" }));
  });

  expect(mocks.getShareToken).toHaveBeenCalledWith({ slug: "trip" });
  expect(mocks.navigate).toHaveBeenCalledWith({
    to: "/t/$slug/breakdown",
    params: { slug: "trip" },
    search: { share: "share-secret", view: "breakdown" },
    replace: true,
  });
  root.unmount();
});

test("breakdown filters by member and shows per-currency summaries and settlements", () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() =>
    root.render(createElement(SharedTabPage, { slug: "trip", share: "secret", view: "breakdown" })),
  );

  expect(container.querySelector('nav[aria-label="Breadcrumb"]')).toBeNull();
  expect(container.textContent).toContain("Weekend getaway");
  expect(container.textContent).toContain("Alex");
  expect(container.textContent).toContain("Dinner");
  expect(container.textContent).toContain("CAD");
  expect(container.textContent).toContain("USD");
  const currencySections = [...container.querySelectorAll("section")].filter((section) =>
    section.querySelector("h2"),
  );
  expect(currencySections[0]?.lastElementChild?.textContent).toContain("Total share");
  expect(currencySections[0]?.lastElementChild?.textContent).toContain("Total covered");
  expect(currencySections[0]?.lastElementChild?.classList.contains("justify-end")).toBe(true);
  expect(currencySections[0]?.lastElementChild?.classList.contains("border-b")).toBe(true);
  expect(currencySections.at(-1)?.lastElementChild?.classList.contains("border-b")).toBe(false);

  expect(container.querySelector('[role="img"][aria-label="Alex"]')).not.toBeNull();
  expect(container.textContent).toContain("Still owed");
  expect(container.textContent).toContain("25.00");
  expect(container.textContent).toContain("Total share");
  expect(container.textContent).toContain("Total covered");
  expect(container.textContent).toContain("Share");
  expect(container.textContent).toContain("Partially repaid");
  expect(container.textContent).toContain("Are owed");
  expect(container.textContent).toContain("32.50");
  const alexCad = [...container.querySelectorAll("section")].find((section) =>
    section.querySelector("h2")?.textContent?.includes("CAD"),
  );
  const alexBalances = [...(alexCad?.querySelectorAll("ul") ?? [])].find((list) =>
    list.textContent?.includes("Sam owes Alex"),
  );
  expect(alexBalances?.textContent).toContain("Sam owes Alex");
  expect(alexBalances?.querySelector("li .font-numeric")?.parentElement?.textContent).toContain(
    "Sam owes Alex",
  );
  expect(alexBalances?.querySelector('[role="img"][aria-label="Sam"]')).not.toBeNull();
  expect(alexBalances?.querySelector("li .font-numeric")?.className).toContain("text-ledger-green");
  expect(alexBalances?.querySelector("button")).toBeNull();
  expect(container.querySelectorAll("[aria-label$='breakdown']")).toHaveLength(0);
  expect(container.querySelector("ul [aria-haspopup='dialog']")).toBeNull();
  const picker = container.querySelector<HTMLButtonElement>("#breakdown-member");
  expect(picker?.textContent).toContain("Alex");
  expect(picker?.parentElement?.className).toContain("w-full");
  expect(picker?.parentElement?.className).not.toContain("bleed");
  expect(container.querySelector("h2 .rounded-full")?.textContent).toBe("CAD");
  flushSync(() => picker?.click());
  const sam = [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
    button.textContent?.includes("Sam"),
  );
  expect(sam).toBeDefined();
  flushSync(() => sam?.click());
  expect(mocks.navigate).toHaveBeenLastCalledWith({
    to: "/t/$slug/breakdown",
    params: { slug: "trip" },
    search: { share: "secret", member: "member-1" },
  });
  flushSync(() =>
    root.render(
      createElement(SharedTabPage, {
        slug: "trip",
        share: "secret",
        view: "breakdown",
        member: "member-1",
      }),
    ),
  );
  expect(container.textContent).toContain("Breakfast");
  expect(container.textContent).not.toContain("Dinner");
  expect(container.querySelector('[role="img"][aria-label="Sam"]')).not.toBeNull();
  expect(container.textContent).toContain("Owe");
  expect(container.textContent).toContain("Paid");
  expect(container.textContent).toContain("Partially paid");
  expect(container.textContent).not.toContain("Repaid");
  expect(container.textContent).not.toContain("Partially repaid");
  const samCadSection = [...container.querySelectorAll("section")].find((section) =>
    section.textContent?.includes("CAD"),
  );
  expect(samCadSection?.textContent).toContain("22.00");
  const samUsdSection = [...container.querySelectorAll("section")].find((section) =>
    section.textContent?.includes("USD"),
  );
  expect(samUsdSection?.textContent).toContain("No expenses for this member.");
  const samExpenseList = [...(samCadSection?.querySelectorAll("ul") ?? [])].find((list) =>
    list.textContent?.includes("Breakfast"),
  );
  expect(samExpenseList).not.toBeNull();
  expect(samExpenseList?.querySelector("button")).toBeNull();
  const samBalances = [...(samCadSection?.querySelectorAll("ul") ?? [])].find((list) =>
    list.textContent?.includes("Sam owes Alex"),
  );
  expect(samBalances?.querySelector('[role="img"][aria-label="Alex"]')).not.toBeNull();
  expect(samBalances?.querySelector("li .font-numeric")?.className).toContain(
    "text-margin-red-ink",
  );
  expect(samBalances?.querySelector("button")).toBeNull();
  expect(container.querySelector('[role="tablist"][aria-label="Expense date"]')).toBeNull();
  expect(container.querySelector('[role="tablist"][aria-label="Shared tab pages"]')).toBeNull();
  const historyButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent?.includes("Payment history"),
  );
  expect(historyButton).toBeDefined();
  mocks.navigate.mockClear();
  flushSync(() => historyButton?.click());
  const dialog = document.querySelector('[data-slot="dialog-content"]');
  expect(dialog?.textContent).toContain("Sam → Alex");
  expect(dialog?.textContent).toContain("1 recorded payment.");
  expect(dialog?.querySelector('[role="img"][aria-label="Sam"]')).not.toBeNull();
  expect(dialog?.querySelector("h3 time[datetime]")).not.toBeNull();
  expect(container.textContent).toContain("Breakfast");
  expect(mocks.navigate).not.toHaveBeenCalled();
  expect(container.querySelector("h1")?.textContent).toBe("Weekend getaway Breakdown");

  mocks.authenticated = true;
  flushSync(() =>
    root.render(createElement(SharedTabPage, { slug: "trip", share: "secret", view: "history" })),
  );
  expect(container.querySelector('nav[aria-label="Breadcrumb"]')).not.toBeNull();
  const tabInfoLink = container.querySelector<HTMLAnchorElement>(
    'nav[aria-label="Breadcrumb"] a[href="/t/$slug"]',
  );
  expect(tabInfoLink?.textContent).toBe("Weekend getaway");
  expect(tabInfoLink).not.toBeNull();
  expect(container.querySelector('nav[aria-label="Breadcrumb"]')?.textContent).toContain(
    "Breakdown",
  );
  expect(container.querySelector('nav[aria-label="Breadcrumb"]')?.textContent).not.toContain(
    "Payment history",
  );
  expect(container.querySelector("h1")?.textContent).toBe("Weekend getaway Breakdown");
  root.unmount();
});

test("date tabs filter every currency, keep summaries, and preserve member and input order", () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 10, 12));
  const cadSam = mocks.data.currencies[0].members.find((member) => member.key === "member-1");
  const usdSam = mocks.data.currencies[1].members.find((member) => member.key === "member-1");
  if (!cadSam || !usdSam) throw new Error("Test fixture members are missing");
  const originalCadExpenses = [...cadSam.expenses];
  const originalUsdExpenses = [...usdSam.expenses];
  const originalCadSummaries = cadSam.summaries;
  const originalUsdSummaries = usdSam.summaries;
  const originalStatuses = [...mocks.data.expenseStatuses];
  cadSam.expenses.push(
    {
      key: "cad-tomorrow",
      name: "CAD tomorrow",
      date: "2026-10-12",
      createdAt: 0,
      paidAmount: 0,
      shareAmount: 6,
      total: 12,
      taxTotal: 0,
      tipTotal: 0,
      items: [],
    },
    {
      key: "cad-today",
      name: "CAD today",
      date: "2026-10-10",
      createdAt: 0,
      paidAmount: 0,
      shareAmount: 7,
      total: 14,
      taxTotal: 0,
      tipTotal: 0,
      items: [],
    },
  );
  usdSam.expenses.push(
    {
      key: "usd-tomorrow",
      name: "USD tomorrow",
      date: "2026-10-15",
      createdAt: 0,
      paidAmount: 0,
      shareAmount: 8,
      total: 16,
      taxTotal: 0,
      tipTotal: 0,
      items: [],
    },
    {
      key: "usd-past",
      name: "USD past",
      date: "2026-09-01",
      createdAt: 0,
      paidAmount: 0,
      shareAmount: 9,
      total: 18,
      taxTotal: 0,
      tipTotal: 0,
      items: [],
    },
    {
      key: "usd-today",
      name: "USD today",
      date: "2026-10-10",
      createdAt: 0,
      paidAmount: 0,
      shareAmount: 10,
      total: 20,
      taxTotal: 0,
      tipTotal: 0,
      items: [],
    },
  );
  cadSam.summaries = {
    paid: {
      totalShare: 29,
      totalCovered: 0,
      stillOwes: 18,
      stillOwed: 4,
      balances: [
        { memberId: "member-0", balance: -18 },
        { memberId: "member-2", balance: 4 },
      ],
    },
    upcoming: {
      totalShare: 6,
      totalCovered: 0,
      stillOwes: 7,
      stillOwed: 3,
      balances: [
        { memberId: "member-0", balance: -7 },
        { memberId: "member-2", balance: 3 },
      ],
    },
    all: {
      totalShare: 35,
      totalCovered: 0,
      stillOwes: 25,
      stillOwed: 7,
      balances: [
        { memberId: "member-0", balance: -25 },
        { memberId: "member-2", balance: 7 },
      ],
    },
  };
  usdSam.summaries = {
    paid: {
      totalShare: 19,
      totalCovered: 0,
      stillOwes: 12,
      stillOwed: 0,
      balances: [{ memberId: "member-0", balance: -12 }],
    },
    upcoming: {
      totalShare: 8,
      totalCovered: 0,
      stillOwes: 8,
      stillOwed: 0,
      balances: [{ memberId: "member-0", balance: -8 }],
    },
    all: {
      totalShare: 27,
      totalCovered: 0,
      stillOwes: 20,
      stillOwed: 0,
      balances: [{ memberId: "member-0", balance: -20 }],
    },
  };
  const expectedCadInputOrder = cadSam.expenses.map((expense) => expense.key);
  const expectedUsdInputOrder = usdSam.expenses.map((expense) => expense.key);
  mocks.data.expenseStatuses.push(
    { expenseSlug: "cad-tomorrow", memberId: "member-1", status: "settled" },
    { expenseSlug: "cad-today", memberId: "member-1", status: "outstanding" },
    { expenseSlug: "usd-past", memberId: "member-1", status: "outstanding" },
    { expenseSlug: "usd-tomorrow", memberId: "member-1", status: "settled" },
  );

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const render = (member = "member-0") =>
    flushSync(() =>
      root.render(
        createElement(SharedTabPage, {
          slug: "trip",
          share: "secret",
          view: "breakdown",
          member,
        }),
      ),
    );
  const currencySection = (code: string) =>
    [...container.querySelectorAll("section")].find((section) =>
      section.querySelector("h2")?.textContent?.includes(code),
    );
  const balanceSection = (code: string) =>
    [...(currencySection(code)?.querySelectorAll("section") ?? [])].find((section) =>
      section.querySelector("h3")?.textContent?.includes("Balances"),
    );
  const expenseList = (code: string) =>
    currencySection(code)?.querySelector(`ul[aria-label="${code} expenses for Sam"]`);
  const listText = (code: string) => expenseList(code)?.textContent ?? "";
  const balancesText = (code: string) => balanceSection(code)?.textContent ?? "";
  const expectSummary = (
    code: string,
    values: { share: number; covered: number; owes: number; owed: number },
  ) => {
    const section = currencySection(code);
    const read = (label: string) =>
      [...(section?.querySelectorAll("p") ?? [])].find(
        (paragraph) => paragraph.textContent === label,
      )?.nextElementSibling?.textContent;
    expect(read("Total share")).toContain(values.share.toFixed(2));
    expect(read("Total covered")).toContain(values.covered.toFixed(2));
    if (values.owes > 0) expect(read("Still owes")).toContain(values.owes.toFixed(2));
    else expect(read("Still owes")).toBeUndefined();
    if (values.owed > 0) expect(read("Still owed")).toContain(values.owed.toFixed(2));
    else expect(read("Still owed")).toBeUndefined();
  };
  const clickTab = (label: string) => {
    const tab = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
      (candidate) => candidate.textContent?.trim() === label,
    );
    if (!tab) throw new Error(`Missing ${label} date tab`);
    flushSync(() => tab.click());
  };

  try {
    const selectMember = (key: string, name: string) => {
      const memberPicker = container.querySelector<HTMLButtonElement>("#breakdown-member");
      flushSync(() => memberPicker?.click());
      const option = [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
        button.textContent?.includes(name),
      );
      flushSync(() => option?.click());
      render(key);
    };

    render();
    expect(container.querySelector('[role="tablist"][aria-label="Expense date"]')).toBeNull();
    expect(container.textContent).toContain("Dinner");
    selectMember("member-1", "Sam");
    expect(container.querySelector('[role="tablist"][aria-label="Expense date"]')).not.toBeNull();
    expect(
      container
        .querySelector('[role="tablist"][aria-label="Expense date"]')
        ?.closest(".card-inset"),
    ).toBeNull();
    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe("Paid");
    expect(container.textContent).toContain("Showing expenses dated today or earlier.");
    expectSummary("CAD", { share: 29, covered: 0, owes: 18, owed: 4 });
    expectSummary("USD", { share: 19, covered: 0, owes: 12, owed: 0 });
    expect(balancesText("CAD")).toContain("Sam owes Alex");
    expect(balancesText("CAD")).toContain("Pat owes Sam");
    expect(balancesText("CAD")).toContain("18.00");
    expect(balancesText("CAD")).toContain("4.00");
    clickTab("Upcoming");
    expect(container.textContent).toContain("Showing expenses dated after today.");
    expect(listText("CAD")).toContain("CAD tomorrow");
    expect(listText("USD")).toContain("USD tomorrow");
    expectSummary("CAD", { share: 6, covered: 0, owes: 7, owed: 3 });
    expectSummary("USD", { share: 8, covered: 0, owes: 8, owed: 0 });
    expect(balancesText("CAD")).toContain("7.00");
    expect(balancesText("CAD")).toContain("3.00");
    selectMember("member-0", "Alex");
    expect(container.querySelector('[role="tablist"][aria-label="Expense date"]')).toBeNull();
    expect(container.textContent).toContain("Dinner");
    selectMember("member-1", "Sam");
    expect(container.querySelector('[role="tablist"][aria-label="Expense date"]')).not.toBeNull();
    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe(
      "Upcoming",
    );
    expect(listText("CAD")).toContain("CAD tomorrow");
    expect(listText("USD")).toContain("USD tomorrow");
    expectSummary("CAD", { share: 6, covered: 0, owes: 7, owed: 3 });
    expectSummary("USD", { share: 8, covered: 0, owes: 8, owed: 0 });

    clickTab("All");
    expect(container.textContent).toContain("Showing all expenses, including upcoming expenses.");
    expect(listText("CAD").indexOf("CAD tomorrow")).toBeLessThan(
      listText("CAD").indexOf("CAD today"),
    );
    expect(listText("CAD").indexOf("CAD today")).toBeLessThan(listText("CAD").indexOf("Breakfast"));
    expect(listText("CAD").indexOf("Brunch")).toBeLessThan(listText("CAD").indexOf("Breakfast"));
    expect(listText("USD").indexOf("USD tomorrow")).toBeLessThan(
      listText("USD").indexOf("USD today"),
    );
    expect(listText("USD").indexOf("USD today")).toBeLessThan(listText("USD").indexOf("USD past"));
    expectSummary("CAD", { share: 35, covered: 0, owes: 25, owed: 7 });
    expectSummary("USD", { share: 27, covered: 0, owes: 20, owed: 0 });
    expect(balancesText("CAD")).toContain("25.00");
    expect(balancesText("CAD")).toContain("7.00");
    expect(balancesText("USD")).toContain("20.00");

    clickTab("Upcoming");
    expect(listText("CAD")).toContain("CAD tomorrow");
    expect(listText("CAD")).not.toContain("CAD today");
    expect(listText("USD")).toContain("USD tomorrow");
    expect(listText("USD")).not.toContain("USD today");
    expectSummary("CAD", { share: 6, covered: 0, owes: 7, owed: 3 });
    expectSummary("USD", { share: 8, covered: 0, owes: 8, owed: 0 });

    clickTab("Paid");
    expect(listText("CAD")).toContain("CAD today");
    expect(listText("CAD")).toContain("Breakfast");
    expect(listText("CAD")).not.toContain("CAD tomorrow");
    expect(listText("USD")).toContain("USD today");
    expect(listText("USD")).toContain("USD past");
    expect(listText("USD")).not.toContain("USD tomorrow");
    expectSummary("CAD", { share: 29, covered: 0, owes: 18, owed: 4 });
    expectSummary("USD", { share: 19, covered: 0, owes: 12, owed: 0 });
    expect(expenseList("CAD")?.querySelectorAll(":scope > li")).toHaveLength(3);
    expect(expenseList("CAD")?.querySelector("button")).toBeNull();
    expect(expenseList("USD")?.querySelector("button")).toBeNull();
    expect(cadSam.expenses.map((expense) => expense.key)).toEqual(expectedCadInputOrder);
    expect(usdSam.expenses.map((expense) => expense.key)).toEqual(expectedUsdInputOrder);
  } finally {
    root.unmount();
    cadSam.expenses.splice(0, cadSam.expenses.length, ...originalCadExpenses);
    usdSam.expenses.splice(0, usdSam.expenses.length, ...originalUsdExpenses);
    cadSam.summaries = originalCadSummaries;
    usdSam.summaries = originalUsdSummaries;
    mocks.data.expenseStatuses.splice(0, mocks.data.expenseStatuses.length, ...originalStatuses);
  }
});

test("members with no unsettled balances see the empty balance state", () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    flushSync(() =>
      root.render(
        createElement(SharedTabPage, {
          slug: "trip",
          share: "secret",
          member: "member-2",
          view: "breakdown",
        }),
      ),
    );
    const balanceSections = [...container.querySelectorAll("p")]
      .filter((paragraph) => paragraph.textContent === "No outstanding balances.")
      .map((paragraph) => paragraph.closest("section"))
      .filter((section): section is HTMLElement => section !== null);
    expect(balanceSections).toHaveLength(2);
    expect(
      balanceSections.every((section) => section.textContent?.includes("No outstanding balances.")),
    ).toBe(true);
    expect(balanceSections.every((section) => section.querySelector("ul, button") === null)).toBe(
      true,
    );
  } finally {
    root.unmount();
  }
});

test("older breakdown responses fall back to member expenses and settlements", () => {
  const statuses = mocks.data.expenseStatuses;
  const alex = mocks.data.currencies[0].members.find((member) => member.key === "member-0");
  if (!alex) throw new Error("Alex test fixture is missing");
  const summaries = alex.summaries;
  Reflect.deleteProperty(mocks.data, "expenseStatuses");
  Reflect.deleteProperty(alex, "summaries");
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    flushSync(() =>
      root.render(
        createElement(SharedTabPage, { slug: "trip", share: "secret", view: "breakdown" }),
      ),
    );
    expect(document.body.textContent).toContain("Dinner");
    const cad = [...container.querySelectorAll("section")].find((section) =>
      section.querySelector("h2")?.textContent?.includes("CAD"),
    );
    const amount = (label: string) =>
      [...(cad?.querySelectorAll("p") ?? [])].find((paragraph) => paragraph.textContent === label)
        ?.nextElementSibling?.textContent;
    expect(amount("Total share")).toContain("25.00");
    expect(amount("Total covered")).toContain("57.50");
    expect(amount("Still owes")).toBeUndefined();
    expect(amount("Still owed")).toContain("25.00");
  } finally {
    root.unmount();
    mocks.data.expenseStatuses = statuses;
    alex.summaries = summaries;
  }
});

test("missing view summaries use visible expenses and leave unscoped balances unknown", () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 10, 12));
  const alex = mocks.data.currencies[0].members.find((member) => member.key === "member-0");
  if (!alex) throw new Error("Alex test fixture is missing");
  const originalExpenses = [...alex.expenses];
  const originalSummaries = alex.summaries;
  alex.expenses.push({
    key: "future-dinner",
    name: "Future dinner",
    date: "2026-10-12",
    createdAt: 1,
    paidAmount: 0,
    shareAmount: 2,
    total: 4,
    taxTotal: 0,
    tipTotal: 0,
    items: [],
  });
  Reflect.deleteProperty(alex, "summaries");

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const summary = (label: string) => {
    const cad = [...container.querySelectorAll("section")].find((section) =>
      section.querySelector("h2")?.textContent?.includes("CAD"),
    );
    return [...(cad?.querySelectorAll("p") ?? [])].find(
      (paragraph) => paragraph.textContent === label,
    )?.nextElementSibling?.textContent;
  };
  const clickTab = (label: string) => {
    const tab = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
      (candidate) => candidate.textContent?.trim() === label,
    );
    if (!tab) throw new Error(`Missing ${label} date tab`);
    flushSync(() => tab.click());
  };

  try {
    flushSync(() =>
      root.render(
        createElement(SharedTabPage, {
          slug: "trip",
          share: "secret",
          view: "breakdown",
          member: "member-0",
        }),
      ),
    );
    expect(summary("Total share")).toContain("25.00");
    expect(summary("Total covered")).toContain("57.50");
    expect(summary("Still owes")).toBeUndefined();
    expect(summary("Still owed")).toBeUndefined();
    clickTab("Upcoming");
    expect(container.textContent).toContain("Future dinner");
    expect(summary("Total share")).toContain("2.00");
    expect(summary("Total covered")).toContain("0.00");
    expect(summary("Still owes")).toBeUndefined();
    expect(summary("Still owed")).toBeUndefined();
    clickTab("All");
    expect(summary("Total share")).toContain("27.00");
    expect(summary("Total covered")).toContain("57.50");
    expect(summary("Still owes")).toBeUndefined();
    expect(summary("Still owed")).toContain("25.00");
  } finally {
    root.unmount();
    alex.expenses.splice(0, alex.expenses.length, ...originalExpenses);
    alex.summaries = originalSummaries;
  }
});

test("legacy history links open a modal over the breakdown", () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() =>
    root.render(createElement(SharedTabPage, { slug: "trip", share: "secret", view: "history" })),
  );
  expect(document.querySelector('[data-slot="dialog-content"]')?.textContent).toContain(
    "Payment history",
  );
  expect(container.textContent).toContain("Dinner");
  expect(container.querySelector('[role="tablist"][aria-label="Expense date"]')).toBeNull();
  expect(container.querySelector('[role="tablist"][aria-label="Shared tab pages"]')).toBeNull();
  root.unmount();
});

test("keeps amounts to pay and receive separate within each currency", () => {
  const settlements = mocks.data.currencies[0].settlements;
  const alex = mocks.data.currencies[0].members.find((member) => member.key === "member-0");
  if (!alex) throw new Error("Alex test fixture is missing");
  const originalSummaries = alex.summaries;
  alex.summaries = {
    ...originalSummaries,
    all: { ...originalSummaries.all, stillOwes: 5 },
  };
  settlements.push({ from: "member-0", to: "member-2", amount: 5 });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    flushSync(() =>
      root.render(
        createElement(SharedTabPage, {
          slug: "trip",
          share: "secret",
          view: "breakdown",
        }),
      ),
    );
    const cad = container.querySelector("section");
    const amount = (label: string) =>
      [...(cad?.querySelectorAll("p") ?? [])].find((element) => element.textContent === label)
        ?.nextElementSibling?.textContent;
    expect(amount("Still owes")).toContain("5.00");
    expect(amount("Still owed")).toContain("25.00");
  } finally {
    settlements.pop();
    alex.summaries = originalSummaries;
    root.unmount();
  }
});

test("reads the member from the URL and preserves it when opening history", () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() =>
    root.render(
      createElement(SharedTabPage, {
        slug: "trip",
        share: "secret",
        member: "member-1",
        view: "breakdown",
      }),
    ),
  );
  expect(container.querySelector("#breakdown-member")?.textContent).toContain("Sam");
  expect(container.textContent).toContain("Breakfast");
  const historyButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent?.includes("Payment history"),
  );
  flushSync(() => historyButton?.click());
  expect(mocks.navigate).not.toHaveBeenCalled();
  expect(container.querySelector("#breakdown-member")?.textContent).toContain("Sam");
  expect(document.querySelector('[data-slot="dialog-content"]')).not.toBeNull();
  flushSync(() =>
    root.render(
      createElement(SharedTabPage, {
        slug: "trip",
        share: "secret",
        member: "member-0",
        view: "breakdown",
      }),
    ),
  );
  expect(container.querySelector("#breakdown-member")?.textContent).toContain("Alex");
  expect(container.textContent).toContain("Dinner");
  root.unmount();
});

test("uses a viewport-contained loading skeleton with one page heading", () => {
  mocks.loading = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() =>
    root.render(
      createElement(SharedTabPage, {
        slug: "trip",
        share: "secret",
        view: "breakdown",
      }),
    ),
  );
  expect(container.querySelector("main[data-viewport-loading]")).not.toBeNull();
  expect(container.querySelectorAll("h1")).toHaveLength(1);
  expect(container.querySelector('[role="status"]')?.textContent).toContain("Loading shared tab");
  expect(container.querySelector('[role="status"]')?.className).toContain("overflow-hidden");
  root.unmount();
});
