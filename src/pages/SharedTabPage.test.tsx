// @vitest-environment happy-dom
import { act, createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticated: false,
  navigate: vi.fn(),
  getShareToken: vi.fn(async () => "share-secret"),
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
  useQuery: () => mocks.data,
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

test("breakdown shows member totals, currency sections, owes, and itemized expense details", () => {
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
  expect(container.textContent).toContain("Sam owes Alex");
  expect(container.querySelector('[role="img"][aria-label="Alex"]')).not.toBeNull();
  expect(container.textContent).toContain("Paid");
  expect(container.textContent).toContain("Share");
  expect(container.textContent).toContain("Partially Settled");
  expect(container.textContent).toContain("Settled");
  expect(container.textContent).not.toContain("outstanding");
  expect(container.textContent).toContain("Total share");
  expect(container.textContent).toContain("Total paid");
  const total = (label: string) =>
    [...container.querySelectorAll("p")].find((row) => row.textContent === label)
      ?.nextElementSibling?.textContent;
  expect(total("Total share")).toContain("25.00");
  expect(total("Total paid")).toContain("57.50");
  const memberDisclosure = container.querySelector<HTMLButtonElement>(
    'button[aria-label="Alex breakdown"]',
  );
  expect(memberDisclosure?.getAttribute("aria-expanded")).toBe("true");
  flushSync(() => memberDisclosure?.click());
  expect(memberDisclosure?.getAttribute("aria-expanded")).toBe("false");
  flushSync(() => memberDisclosure?.click());
  expect(memberDisclosure?.getAttribute("aria-expanded")).toBe("true");
  const disclosure = container.querySelector<HTMLButtonElement>('button[aria-expanded="false"]');
  expect(disclosure).not.toBeNull();
  flushSync(() => disclosure?.click());
  expect(disclosure?.getAttribute("aria-expanded")).toBe("true");
  expect(container.textContent).toContain("Pasta");
  expect(container.textContent).toContain("Total cost");
  expect(container.textContent).toContain("Tax");
  expect(container.textContent).toContain("Tip");
  expect(container.textContent).toContain("Expense total");
  flushSync(() => disclosure?.click());
  expect(disclosure?.getAttribute("aria-expanded")).toBe("false");
  expect(container.querySelector('[role="tablist"][aria-label="Shared tab pages"]')).not.toBeNull();
  expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe(
    "Breakdown",
  );
  flushSync(() =>
    root.render(createElement(SharedTabPage, { slug: "trip", share: "secret", view: "history" })),
  );
  expect(container.textContent).toContain("Sam paid Alex");
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
