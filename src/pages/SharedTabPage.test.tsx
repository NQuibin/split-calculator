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
            expenses: [
              {
                key: "dinner",
                name: "Dinner",
                date: "2026-10-02",
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
            expenses: [
              {
                key: "breakfast",
                name: "Breakfast",
                date: "2026-10-02",
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
            expenses: [
              {
                key: "breakfast",
                name: "Breakfast",
                date: "2026-10-02",
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
          { key: "member-0", name: "Alex", balance: 12, expenses: [] },
          { key: "member-1", name: "Sam", balance: -12, expenses: [] },
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
  expect(container.querySelector('[role="img"][aria-label="Alex"]')).not.toBeNull();
  expect(container.textContent).toContain("Still owed");
  expect(container.textContent).toContain("25.00");
  expect(container.textContent).toContain("Total share");
  expect(container.textContent).toContain("Total covered");
  expect(container.textContent).toContain("Share");
  expect(container.textContent).toContain("Partially repaid");
  expect(container.textContent).toContain("Are owed");
  expect(container.textContent).toContain("32.50");
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
    search: { share: "secret", view: "breakdown", member: "member-1" },
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
  expect(container.querySelector('[role="tablist"][aria-label="Shared tab pages"]')).not.toBeNull();
  expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe(
    "Breakdown",
  );
  flushSync(() =>
    root.render(createElement(SharedTabPage, { slug: "trip", share: "secret", view: "history" })),
  );
  expect(container.textContent).toContain("Sam → Alex");
  expect(container.textContent).toContain("1 recorded payment.");
  expect(container.querySelector('[role="img"][aria-label="Sam"]')).not.toBeNull();
  expect(container.querySelector("h3 time[datetime]")).not.toBeNull();
  expect(container.textContent).not.toContain("Dinner");
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

test("breakdown remains readable while dev returns the older response without statuses", () => {
  const statuses = mocks.data.expenseStatuses;
  Reflect.deleteProperty(mocks.data, "expenseStatuses");
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
  } finally {
    root.unmount();
    mocks.data.expenseStatuses = statuses;
  }
});

test("switching to payment history navigates on the breakdown route with the history view", () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() =>
    root.render(createElement(SharedTabPage, { slug: "trip", share: "secret", view: "breakdown" })),
  );

  flushSync(() =>
    (container.querySelector('[role="tab"]:nth-child(2)') as HTMLButtonElement).click(),
  );

  expect(mocks.navigate).toHaveBeenCalledWith({
    to: "/t/$slug/breakdown",
    params: { slug: "trip" },
    search: { share: "secret", view: "history" },
  });
  root.unmount();
});

test("keeps amounts to pay and receive separate within each currency", () => {
  const settlements = mocks.data.currencies[0].settlements;
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
    root.unmount();
  }
});

test("reads the member from the URL and preserves it when switching views", () => {
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
  flushSync(() =>
    (container.querySelector('[role="tab"]:nth-child(2)') as HTMLButtonElement).click(),
  );
  expect(mocks.navigate).toHaveBeenLastCalledWith({
    to: "/t/$slug/breakdown",
    params: { slug: "trip" },
    search: { share: "secret", view: "history", member: "member-1" },
  });
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
