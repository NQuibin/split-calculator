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
    }: {
      children: React.ReactNode;
      to: string;
      params?: { slug: string };
    }) => React.createElement("a", { href: to.replace("$slug", params?.slug ?? "") }, children),
    getRouteApi: () => ({
      useParams: () => ({ slug: "trip" }),
      useSearch: () => ({ view: mocks.view }),
    }),
    useNavigate: () => mocks.navigate,
  };
});

import { RecordPaymentPage } from "./RecordPaymentPage";

afterEach(() => {
  mocks.response = null;
  mocks.view = "paid";
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

function mount(response = paymentData) {
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
  await Promise.resolve();
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
  expect(mocks.navigate).toHaveBeenCalledWith({
    to: "/t/$slug",
    params: { slug: "trip" },
    replace: true,
  });
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
  expect(fullAmount.className).toContain("px-3 py-2");
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

test("groups choices by currency and renders field rows with 32px avatars", () => {
  const { container, root } = mount({
    ...paymentData,
    currencies: [
      ...paymentData.currencies,
      {
        currency: "USD",
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
