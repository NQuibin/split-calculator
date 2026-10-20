// @vitest-environment happy-dom
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tab: undefined as unknown,
  queryResults: [] as unknown[],
  queryIndex: 0,
  navigate: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useQuery: () => mocks.queryResults[mocks.queryIndex++],
  useMutation: () => vi.fn(async () => "share-secret"),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
    createElement("a", { href: to }, children),
  getRouteApi: () => ({ useParams: () => ({ slug: "trip" }), useSearch: () => ({}) }),
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/lib/tabSync", () => ({
  useTab: () => {
    mocks.queryIndex = 0;
    return mocks.tab;
  },
  useTabActions: () => ({
    claimMember: vi.fn(),
    deleteTab: vi.fn(),
    addMember: vi.fn(),
    renameMember: vi.fn(),
    removeMember: vi.fn(),
  }),
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
  mocks.navigate.mockClear();
  document.body.replaceChildren();
});

test("View breakdown is an immediate link in the scrollable action row", () => {
  mocks.tab = {
    name: "Trip",
    slug: "trip",
    members: [{ id: "viewer-seat", name: "Nikki", claimed: true, resolvedId: "viewer" }],
    defaultCurrency: "CAD",
    isOwner: true,
    ownerName: "Nikki",
  };
  mocks.queryResults = [[], { _id: "viewer" }, { paid: {}, upcoming: {}, all: {} }];
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => root.render(createElement(TabPage)));

  const link = [...container.querySelectorAll<HTMLAnchorElement>("a")].find(
    (candidate) => candidate.textContent === "View breakdown",
  );
  expect(link?.getAttribute("href")).toBe("/t/$slug/breakdown");
  expect(link?.closest(".overflow-x-auto")).not.toBeNull();
  expect(container.textContent).not.toContain("Opening…");
  root.unmount();
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
  expect(container.textContent).toContain("TotalCA$0.00");
  expect(container.querySelector('[aria-label="Search tab expenses"]')).toBeNull();
  root.unmount();
});

test("sums and groups converted totals by currency for the active view", () => {
  const person = { id: "member", name: "Nikki" };
  const item = (id: string, cost: number) => ({
    id,
    name: id,
    cost,
    discount: { mode: "amount", value: 0 },
    tax: { mode: "amount", value: 0 },
    tip: { mode: "amount", value: 0 },
    splitWith: [person.id],
  });
  mocks.tab = {
    name: "Trip",
    slug: "trip",
    members: [{ ...person, claimed: true, resolvedId: "viewer" }],
    defaultCurrency: "CAD",
    isOwner: false,
    ownerName: "Nikki",
  };
  mocks.queryResults = [
    [
      {
        date: "2020-01-02",
        createdBy: person,
        slug: "paid-eur",
        name: "Paid train",
        people: [person],
        items: [item("paid-eur-item", 5)],
        settlementCurrency: "EUR",
        currency: "EUR",
      },
      {
        date: "2020-01-01",
        createdBy: person,
        slug: "paid",
        name: "Paid meal",
        people: [person],
        items: [item("paid-item", 10)],
        settlementCurrency: "CAD",
        currency: "USD",
        exchangeRate: { rate: 1.5 },
      },
      {
        date: "2020-01-03",
        createdBy: person,
        slug: "paid-more",
        name: "Paid taxi",
        people: [person],
        items: [item("paid-more-item", 2)],
        settlementCurrency: "CAD",
        currency: "CAD",
      },
      {
        date: "9999-01-01",
        createdBy: person,
        slug: "upcoming",
        name: "Future meal",
        people: [person],
        items: [item("upcoming-item", 20)],
        settlementCurrency: "EUR",
        currency: "EUR",
      },
    ],
    { _id: "viewer" },
    { paid: {}, upcoming: {}, all: {} },
  ];
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => root.render(createElement(TabPage)));

  const total = [...container.querySelectorAll("div")].find((element) =>
    element.textContent?.startsWith("Total"),
  );
  expect(total?.textContent).toContain("CA$17.00");
  expect(total?.textContent).toContain("€5.00");
  expect([...total!.querySelectorAll(".font-numeric")].map((amount) => amount.textContent)).toEqual(
    ["CA$17.00", "€5.00"],
  );
  expect(container.textContent).toContain("Paid meal");
  expect(container.textContent).not.toContain("Future meal");

  const upcoming = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === "Upcoming",
  );
  flushSync(() => upcoming?.click());
  const upcomingTotal = [...container.querySelectorAll("div")].find((element) =>
    element.textContent?.startsWith("Total"),
  );
  expect(upcomingTotal?.textContent).toContain("€20.00");
  expect(upcomingTotal?.textContent).not.toContain("CA$");
  root.unmount();
});

test("delete tab confirmation adds its own backdrop and names the tab", () => {
  mocks.tab = {
    name: "Weekend getaway",
    slug: "trip",
    members: [],
    defaultCurrency: "CAD",
    isOwner: true,
    ownerName: "Nikki",
  };
  mocks.queryResults = [[], { _id: "viewer" }, { paid: {}, upcoming: {}, all: {} }];
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => root.render(createElement(TabPage)));

  flushSync(() =>
    container.querySelector<HTMLButtonElement>('[aria-label="Tab settings"]')?.click(),
  );
  expect(document.querySelectorAll('[data-slot="dialog-backdrop"][data-open]')).toHaveLength(1);
  flushSync(() =>
    [...document.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent === "Delete tab")
      ?.click(),
  );
  const confirmation = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].find(
    (dialog) => dialog.textContent?.includes("Delete this tab?"),
  );
  expect(document.querySelectorAll('[data-slot="dialog-backdrop"][data-open]')).toHaveLength(2);
  expect(confirmation?.textContent).toContain("Delete this tab?");
  expect(confirmation?.querySelector("strong")?.textContent).toBe("Weekend getaway");
  expect(confirmation?.textContent).toContain(
    "You are deleting Weekend getaway, this can’t be undone.",
  );
  flushSync(() =>
    [...(confirmation?.querySelectorAll<HTMLButtonElement>("button") ?? [])]
      .find((button) => button.textContent === "Cancel")
      ?.click(),
  );
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Tab settings");
  root.unmount();
});

test("tab settings closes when member management opens", () => {
  mocks.tab = {
    name: "Weekend getaway",
    slug: "trip",
    members: [{ id: "member-1", name: "Nikki", claimed: true, resolvedId: "viewer" }],
    defaultCurrency: "CAD",
    isOwner: true,
    ownerName: "Nikki",
  };
  mocks.queryResults = [[], { _id: "viewer" }, { paid: {}, upcoming: {}, all: {} }];
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => root.render(createElement(TabPage)));

  flushSync(() =>
    container.querySelector<HTMLButtonElement>('[aria-label="Tab settings"]')?.click(),
  );
  const settings = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].find((dialog) =>
    dialog.textContent?.includes("Tab settings"),
  );
  expect(settings?.querySelector('input[id="tab-name-settings"]')).not.toBeNull();
  const nameField = settings?.querySelector('input[id="tab-name-settings"]');
  const membersHeading = [...(settings?.querySelectorAll("h3") ?? [])].find(
    (heading) => heading.textContent === "Members",
  );
  expect(membersHeading).not.toBeUndefined();
  expect(
    (nameField?.compareDocumentPosition(membersHeading!) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  const manage = [...(settings?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find(
    (button) => button.textContent?.includes("Manage"),
  );
  expect(manage).toBeDefined();
  expect(manage?.querySelector('[role="img"][aria-label="Nikki"]')).not.toBeNull();

  flushSync(() => manage?.click());
  expect(document.querySelectorAll('[data-slot="dialog-backdrop"][data-open]')).toHaveLength(1);
  const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')];
  const members = dialogs.find((dialog) => dialog.textContent?.includes("1 person in this tab"));
  expect(members?.textContent).toContain("Members");
  expect(settings?.hasAttribute("data-open")).toBe(false);

  flushSync(() =>
    members?.querySelector<HTMLButtonElement>('[aria-label="Back to tab settings"]')?.click(),
  );
  expect(settings?.hasAttribute("data-open")).toBe(true);
  expect(members?.hasAttribute("data-open")).toBe(false);
  expect(document.querySelectorAll('[data-slot="dialog-backdrop"][data-open]')).toHaveLength(1);

  flushSync(() => manage?.click());

  flushSync(() =>
    members?.querySelector<HTMLButtonElement>('[aria-label="Close members"]')?.click(),
  );
  expect(document.querySelectorAll('[data-slot="dialog-backdrop"][data-open]')).toHaveLength(0);
  root.unmount();
});

test("member management protects claimed names and expense participants, and confirms removal", () => {
  mocks.tab = {
    name: "Trip",
    slug: "trip",
    members: [
      { id: "claimed", name: "Nikki", claimed: true, resolvedId: "viewer" },
      { id: "in-expense", name: "Sam", claimed: false, resolvedId: "in-expense" },
      { id: "free", name: "Alex", claimed: false, resolvedId: "free" },
    ],
    defaultCurrency: "CAD",
    isOwner: true,
    ownerName: "Nikki",
  };
  mocks.queryResults = [
    [
      {
        date: "9999-01-01",
        payerId: "claimed",
        people: [],
        items: [{ splitWith: ["in-expense"] }],
      },
    ],
    { _id: "viewer" },
    { paid: {}, upcoming: {}, all: {} },
  ];
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => root.render(createElement(TabPage)));

  flushSync(() =>
    [...container.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.includes("Manage"))
      ?.click(),
  );
  const members = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].find((dialog) =>
    dialog.textContent?.includes("3 people in this tab"),
  );
  expect(members).toBeDefined();
  expect(members?.querySelector('[aria-label="Edit Nikki"]')).toBeNull();
  expect(members?.querySelector<HTMLButtonElement>('[aria-label="Remove Nikki"]')?.disabled).toBe(
    true,
  );
  expect(members?.querySelector<HTMLButtonElement>('[aria-label="Remove Sam"]')?.disabled).toBe(
    true,
  );
  expect(members?.querySelector('[aria-label="Edit Sam"]')).not.toBeNull();
  expect(members?.querySelector("header")?.textContent).toContain("Members");
  expect(members?.querySelector("footer")?.textContent).toContain("Add member");
  expect(members?.querySelector("ul")?.classList.contains("bg-field")).toBe(true);
  expect(members?.querySelector("ul")?.classList.contains("divide-y")).toBe(true);
  expect(members?.querySelector("li")?.classList.contains("rounded-lg")).toBe(false);
  expect(members?.querySelectorAll("#member-removal-note")).toHaveLength(1);
  expect(members?.querySelector("#member-removal-note")?.textContent).toContain(
    "Remove expenses involving a member",
  );

  flushSync(() =>
    [...(members?.querySelectorAll<HTMLButtonElement>("footer button") ?? [])]
      .find((button) => button.textContent?.includes("Add member"))
      ?.click(),
  );
  const addMember = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].find((dialog) =>
    dialog.querySelector('[aria-label="Back to members"]'),
  );
  expect(addMember?.textContent).toContain("Add member");
  expect(addMember?.querySelector('input[aria-label="Member name"]')).not.toBeNull();
  const addActions = addMember?.querySelector("form > div:last-child");
  expect(addActions?.classList.contains("justify-end")).toBe(true);
  expect(
    [...(addActions?.querySelectorAll<HTMLButtonElement>("button") ?? [])].map(
      (button) => button.textContent,
    ),
  ).toEqual(["Cancel", "Add"]);
  expect(document.querySelectorAll('[data-slot="dialog-backdrop"][data-open]')).toHaveLength(2);
  expect(members?.hasAttribute("data-open")).toBe(true);
  flushSync(() =>
    addMember?.querySelector<HTMLButtonElement>('[aria-label="Back to members"]')?.click(),
  );
  expect(document.querySelectorAll('[data-slot="dialog-backdrop"][data-open]')).toHaveLength(1);
  expect(members?.hasAttribute("data-open")).toBe(true);

  flushSync(() => members?.querySelector<HTMLButtonElement>('[aria-label="Remove Alex"]')?.click());
  const confirmation = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].find(
    (dialog) => dialog.textContent?.includes("Remove this member?"),
  );
  expect(confirmation?.textContent).toContain("You are removing Alex from this tab");
  expect(document.querySelectorAll('[data-slot="dialog-backdrop"][data-open]')).toHaveLength(2);
  expect(members?.hasAttribute("data-open")).toBe(true);
  flushSync(() =>
    [...(confirmation?.querySelectorAll<HTMLButtonElement>("button") ?? [])]
      .find((button) => button.textContent === "Cancel")
      ?.click(),
  );
  expect(members?.hasAttribute("data-open")).toBe(true);
  root.unmount();
});
