// @vitest-environment happy-dom
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  response: null as unknown,
  record: vi.fn(async (_args: { payments: Record<string, unknown>[] }) => null),
  navigate: vi.fn(async () => undefined),
  view: "paid",
  memberId: undefined as string | undefined,
  currency: undefined as string | undefined,
}));

vi.mock("convex/react", () => ({
  useQuery: () => mocks.response,
  useMutation: () => mocks.record,
}));
vi.mock("@/lib/tabSync", () => ({
  useTab: () => ({ name: "Trip", slug: "trip" }),
}));
vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  return {
    Link: ({
      children,
      to,
      params,
      ...props
    }: {
      children: React.ReactNode;
      to: string;
      params?: { slug: string };
    } & React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
      React.createElement(
        "a",
        { href: to.replace("$slug", params?.slug ?? ""), ...props },
        children,
      ),
    getRouteApi: () => ({
      useParams: () => ({ slug: "trip" }),
      useSearch: () => ({
        view: mocks.view,
        memberId: mocks.memberId,
        currency: mocks.currency,
      }),
    }),
    useNavigate: () => mocks.navigate,
  };
});

import { RecordPaymentPage } from "./RecordPaymentPage";

afterEach(() => {
  mocks.response = null;
  mocks.view = "paid";
  mocks.memberId = undefined;
  mocks.currency = undefined;
  mocks.record.mockReset();
  mocks.record.mockResolvedValue(null);
  mocks.navigate.mockClear();
  document.body.replaceChildren();
});

const paymentData = {
  viewerMemberId: "viewer",
  missingPayers: [],
  history: [],
  currencies: [
    {
      currency: "CAD",
      directBalances: [{ fromMemberId: "p2", toMemberId: "viewer", amount: 60 }],
      members: [
        { memberId: "viewer", name: "Nikki Q", balance: 0, expenses: [] },
        {
          memberId: "p2",
          name: "P2",
          balance: 30,
          balanceWithViewer: 60,
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
        { memberId: "alex", name: "Alex", balance: 0, balanceWithViewer: 0, expenses: [] },
      ],
    },
  ],
};

function mount(
  response: Omit<typeof paymentData, "viewerMemberId"> & {
    viewerMemberId: string | null;
  } = paymentData,
) {
  mocks.response = { paid: response, upcoming: response, all: response };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => root.render(createElement(RecordPaymentPage)));
  return { container, root };
}

function clickButton(root: ParentNode, text: string) {
  const control = [...root.querySelectorAll("button")].find((node) =>
    node.textContent?.includes(text),
  );
  if (!control) throw new Error(`Missing button: ${text}`);
  flushSync(() => control.click());
  return control;
}

function clickCheckboxRow(root: ParentNode, text: string) {
  const row = [...root.querySelectorAll("label")].find((node) => node.textContent?.includes(text));
  const checkbox = row?.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (!checkbox) throw new Error(`Missing checkbox row: ${text}`);
  flushSync(() => checkbox.click());
  return row;
}

function enterAmount(key: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(`#payment-amount-${key}`);
  if (!input) throw new Error("Missing payment amount input");
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  flushSync(() => input.dispatchEvent(new Event("input", { bubbles: true })));
}

async function submit() {
  const form = document.querySelector("form");
  if (!form) throw new Error("Missing payment form");
  flushSync(() => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test("records a payment without expense allocations and preserves the selected view", async () => {
  mocks.view = "upcoming";
  const { container, root } = mount();
  expect(container.textContent).toContain("Tabs");
  expect(container.textContent).toContain("Trip");
  expect(
    container.querySelectorAll('nav[aria-label="Breadcrumb"] ol > li:not([aria-hidden="true"])'),
  ).toHaveLength(3);
  expect(container.querySelectorAll("h1")).toHaveLength(1);
  const memberRow = clickCheckboxRow(container, "P2 owes you");
  expect(memberRow?.textContent).toContain("P2 owes you CA$60.00");
  expect(memberRow?.lastElementChild?.getAttribute("aria-hidden")).toBe("true");
  clickButton(container, "Continue");
  enterAmount("p2-CAD", "40");
  await submit();
  expect(mocks.record).toHaveBeenCalledWith(
    expect.objectContaining({
      slug: "trip",
      view: "upcoming",
      payments: [
        expect.objectContaining({
          fromMemberId: "p2",
          toMemberId: "viewer",
          amount: 40,
          currency: "CAD",
        }),
      ],
    }),
  );
  expect(mocks.record.mock.calls[0]?.[0].payments[0]).not.toHaveProperty("allocations");
  expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain("Payment recorded");
  const overviewButton = document.body.querySelector<HTMLAnchorElement>(
    '[role="dialog"] a[href="/t/trip"]',
  );
  expect(overviewButton?.textContent).toContain("Back to tab overview");
  expect(overviewButton?.className).toContain("bg-primary");
  expect(overviewButton?.querySelector("svg")).not.toBeNull();
  expect(mocks.navigate).not.toHaveBeenCalled();
  root.unmount();
});

test("preselects the member and currency passed in the route search", () => {
  mocks.memberId = "p2";
  mocks.currency = "CAD";
  const { container, root } = mount();
  expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(true);
  expect(
    [...container.querySelectorAll("label")].find((label) =>
      label.textContent?.includes("P2 owes you"),
    ),
  ).toBeDefined();
  root.unmount();
});

test("shows the direct balance and can fill the full payment amount", async () => {
  const { container, root } = mount();
  clickCheckboxRow(container, "P2 owes you");
  const continueButton = clickButton(container, "Continue");
  expect(continueButton.className).toContain("w-full");

  expect(container.textContent).toContain("Payment from P2");
  expect(container.textContent).toContain("You are owed CA$60.00");
  expect(container.querySelector('[role="img"][aria-label="P2"]')).not.toBeNull();
  expect(container.querySelector('label[for="payment-amount-p2-CAD"]')?.textContent).toBe("Amount");

  const fullAmount = clickCheckboxRow(container, "Record full amount");
  if (!fullAmount) throw new Error("Missing full payment option");
  expect(fullAmount.className).toContain("w-fit");
  expect(fullAmount.className).not.toContain("px-3 py-2");
  expect(fullAmount.className).not.toContain("hover:bg-wash");
  expect(fullAmount.querySelector('[aria-hidden="true"]')?.previousElementSibling?.tagName).toBe(
    "INPUT",
  );
  expect(container.querySelector<HTMLInputElement>("#payment-amount-p2-CAD")?.value).toBe("60.00");
  expect(fullAmount.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(true);
  const submitButton = clickButton(container, "Record payment");
  expect(submitButton.className).toContain("w-full");
  await submit();
  expect(mocks.record).toHaveBeenCalledWith(
    expect.objectContaining({
      payments: [expect.objectContaining({ amount: 60 })],
    }),
  );
  root.unmount();
});

test("keeps the submitted form visible behind success after the live balance clears", async () => {
  const { container, root } = mount();
  clickCheckboxRow(container, "P2 owes you");
  clickButton(container, "Continue");
  enterAmount("p2-CAD", "60");
  mocks.record.mockImplementationOnce(async () => {
    const updated = {
      ...paymentData,
      currencies: [
        {
          ...paymentData.currencies[0],
          directBalances: [],
          members: paymentData.currencies[0].members.map((member) =>
            member.memberId === "p2" ? { ...member, balanceWithViewer: 0 } : member,
          ),
        },
      ],
    };
    mocks.response = { paid: updated, upcoming: updated, all: updated };
    return null;
  });

  await submit();

  expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain("Payment recorded");
  expect(container.textContent).toContain("Payment from P2");
  expect(container.querySelector<HTMLInputElement>("#payment-amount-p2-CAD")?.value).toBe("60");
  root.unmount();
});

test("keeps a nonzero member eligible when they have no expense rows", () => {
  const response = {
    ...paymentData,
    currencies: [
      {
        ...paymentData.currencies[0],
        members: paymentData.currencies[0].members.map((member) =>
          member.memberId === "p2" ? { ...member, expenses: [] } : member,
        ),
      },
    ],
  };
  const { container, root } = mount(response);
  expect(container.textContent).toContain("P2 owes you CA$60.00");
  root.unmount();
});

test("records an outgoing payment when the viewer owes the selected member", async () => {
  const outgoing = {
    ...paymentData,
    currencies: [
      {
        ...paymentData.currencies[0],
        directBalances: [{ fromMemberId: "viewer", toMemberId: "alex", amount: 30 }],
        members: paymentData.currencies[0].members.map((member) =>
          member.memberId === "p2"
            ? { ...member, balanceWithViewer: 0 }
            : member.memberId === "alex"
              ? {
                  ...member,
                  balanceWithViewer: -30,
                  expenses: [
                    {
                      expenseId: "e3",
                      expenseSlug: "alex",
                      name: "Alex paid",
                      date: "2026-09-03",
                      outstanding: 30,
                    },
                  ],
                }
              : member,
        ),
      },
    ],
  };
  const { container, root } = mount(outgoing);
  clickCheckboxRow(container, "You owe Alex");
  clickButton(container, "Continue");
  enterAmount("alex-CAD", "10");
  await submit();
  expect(mocks.record).toHaveBeenCalledWith(
    expect.objectContaining({
      payments: [
        expect.objectContaining({
          fromMemberId: "viewer",
          toMemberId: "alex",
          amount: 10,
        }),
      ],
    }),
  );
  root.unmount();
});

test("records a payment for another member with a direct balance", async () => {
  const response = {
    ...paymentData,
    currencies: [
      {
        ...paymentData.currencies[0],
        directBalances: [
          { fromMemberId: "p2", toMemberId: "viewer", amount: 60 },
          { fromMemberId: "p2", toMemberId: "alex", amount: 25 },
        ],
      },
    ],
  };
  mocks.memberId = "p2";
  mocks.currency = "CAD";
  const { container, root } = mount(response);
  const actor = container.querySelector<HTMLButtonElement>("#payment-actor");
  expect(actor?.textContent).toContain("Nikki Q");
  expect(actor?.querySelector('[role="img"][aria-label="Nikki Q"]')).not.toBeNull();
  flushSync(() => actor?.click());
  const menu = document.querySelector('[data-slot="popover-content"]');
  expect(menu?.textContent).toContain("Alex");
  expect(menu?.querySelector('[role="img"][aria-label="Alex"]')).not.toBeNull();
  const alex = [...(menu?.querySelectorAll("button") ?? [])].find((button) =>
    button.textContent?.includes("Alex"),
  );
  flushSync(() => alex?.click());
  expect(actor?.textContent).toContain("Alex");
  expect(actor?.querySelector('[role="img"][aria-label="Alex"]')).not.toBeNull();
  expect(document.querySelector('[data-slot="popover-content"]')?.hasAttribute("data-closed")).toBe(
    true,
  );
  expect(container.textContent).toContain("P2 owes Alex CA$25.00");
  expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(false);
  clickCheckboxRow(container, "P2 owes Alex");
  clickButton(container, "Continue");
  enterAmount("p2-CAD", "10");
  await submit();
  expect(mocks.record).toHaveBeenCalledWith(
    expect.objectContaining({
      payments: [expect.objectContaining({ fromMemberId: "p2", toMemberId: "alex", amount: 10 })],
    }),
  );
  root.unmount();
});

test("allows a tab owner without a seat to select a member with an open balance", () => {
  const { container, root } = mount({ ...paymentData, viewerMemberId: null });
  expect(container.querySelector<HTMLButtonElement>("#payment-actor")?.textContent).toContain(
    "Nikki Q",
  );
  expect(container.textContent).toContain("P2 owes Nikki Q CA$60.00");
  root.unmount();
});

test("groups choices by currency and renders field rows with 32px avatars", () => {
  const { container, root } = mount({
    ...paymentData,
    currencies: [
      ...paymentData.currencies,
      {
        currency: "USD",
        directBalances: [{ fromMemberId: "viewer", toMemberId: "sam", amount: 20 }],
        members: [
          { memberId: "viewer", name: "Nikki Q", balance: 0, expenses: [] },
          {
            memberId: "sam",
            name: "Sam",
            balance: -20,
            balanceWithViewer: -20,
            expenses: [
              {
                expenseId: "e4",
                expenseSlug: "hotel",
                name: "Hotel",
                date: "2026-09-04",
                outstanding: 20,
              },
            ],
          },
        ],
      },
    ],
  });

  expect(container.querySelectorAll("section[aria-labelledby^='payment-currency-']")).toHaveLength(
    2,
  );
  const memberRow = [...container.querySelectorAll("label")].find((label) =>
    label.textContent?.includes("P2 owes you"),
  );
  if (!memberRow) throw new Error("Missing CAD member row");
  expect(memberRow.className).toContain("bg-field");
  expect(memberRow.querySelector('[role="img"]')?.className).toContain("h-8");
  expect(memberRow.lastElementChild?.getAttribute("aria-hidden")).toBe("true");
  root.unmount();
});

test("keeps separate sections and submits the combined payments only when all are valid", async () => {
  const multiCurrency = {
    ...paymentData,
    currencies: [
      ...paymentData.currencies,
      {
        currency: "USD",
        directBalances: [{ fromMemberId: "viewer", toMemberId: "sam", amount: 20 }],
        members: [
          { memberId: "viewer", name: "Nikki Q", balance: 0, expenses: [] },
          {
            memberId: "sam",
            name: "Sam",
            balance: -20,
            balanceWithViewer: -20,
            expenses: [
              {
                expenseId: "e4",
                expenseSlug: "hotel",
                name: "Hotel",
                date: "2026-09-04",
                outstanding: 20,
              },
            ],
          },
        ],
      },
    ],
  };
  const { container, root } = mount(multiCurrency);
  clickCheckboxRow(container, "P2 owes you");
  clickCheckboxRow(container, "You owe Sam");
  clickButton(container, "Continue");
  expect(container.textContent).toContain("Payment from P2");
  expect(container.textContent).toContain("Payment to Sam");
  const submitButton = clickButton(container, "Record payment");
  expect(submitButton.disabled).toBe(true);

  enterAmount("p2-CAD", "61");
  expect(container.textContent).toContain("Payment cannot exceed the direct balance");
  expect(submitButton.disabled).toBe(true);
  enterAmount("p2-CAD", "40");
  expect(submitButton.disabled).toBe(true);
  enterAmount("sam-USD", "5");
  expect(submitButton.disabled).toBe(false);
  await submit();
  expect(mocks.record).toHaveBeenCalledWith(
    expect.objectContaining({
      slug: "trip",
      payments: [
        expect.objectContaining({
          fromMemberId: "p2",
          toMemberId: "viewer",
          amount: 40,
          currency: "CAD",
        }),
        expect.objectContaining({
          fromMemberId: "viewer",
          toMemberId: "sam",
          amount: 5,
          currency: "USD",
        }),
      ],
    }),
  );
  root.unmount();
});

test("returns to selection outside the card and preserves choices and drafts", () => {
  const { container, root } = mount();
  clickCheckboxRow(container, "P2 owes you");
  clickButton(container, "Continue");
  enterAmount("p2-CAD", "10");
  const changeButton = clickButton(container, "Change member");
  const panel = container.querySelector("main > div.border");
  expect(panel?.contains(changeButton)).toBe(false);
  expect(panel?.textContent).toContain("P2 owes you CA$60.00");
  const selectedMember = [...(panel?.querySelectorAll("label") ?? [])].find((label) =>
    label.textContent?.includes("P2 owes you"),
  );
  expect(selectedMember?.querySelector<HTMLInputElement>("input")?.checked).toBe(true);
  clickButton(container, "Continue");
  expect(container.querySelector<HTMLInputElement>("#payment-amount-p2-CAD")?.value).toBe("10");
  root.unmount();
});
