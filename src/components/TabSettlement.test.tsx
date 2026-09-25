// @vitest-environment happy-dom
import { createElement, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { renderMarkup } from "@/test/render";

const mocks = vi.hoisted(() => ({
  remote: undefined as unknown,
  mutation: vi.fn(),
  query: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => {
    mocks.query(...args);
    return mocks.remote;
  },
  useMutation: () => mocks.mutation,
}));
// The card links to the breakdown page, and TanStack's `Link` reads a router
// context that `renderMarkup` deliberately never builds - without this it
// throws on `isServer` and the whole card renders empty. Stub it down to the
// anchor it would have produced, so these stay plain component tests.
vi.mock("@tanstack/react-router", async () => {
  const { createElement: h } = await import("react");
  return {
    Link: ({
      to,
      params: _params,
      children,
      ...rest
    }: {
      to: string;
      params?: Record<string, string>;
      children?: ReactNode;
      className?: string;
    }) => h("a", { href: to, ...rest }, children),
  };
});

import { SettlementSummary, TabSettlement, type SettlementSummaryData } from "./TabSettlement";

afterEach(() => {
  mocks.remote = undefined;
  vi.clearAllMocks();
});

const viewerData: SettlementSummaryData = {
  viewerMemberId: "alex",
  missingPayers: [],
  currencies: [
    { currency: "CAD", members: [{ memberId: "alex", name: "Alex", balance: 7.34 }] },
    { currency: "USD", members: [{ memberId: "alex", name: "Alex", balance: -0.5 }] },
  ],
};

test("renders each viewer currency once with its own balance", () => {
  const markup = renderMarkup(createElement(SettlementSummary, { data: viewerData }));
  expect(markup).toContain("CAD");
  expect(markup).toContain("You get ");
  expect(markup).toContain("USD");
  expect(markup).toContain("You owe ");
  expect(markup.match(/CA\$7\.34/g)).toHaveLength(2);
  expect(markup.match(/\$0\.50/g)).toHaveLength(2);
});

test("renders the viewer as the first shared-layout single-currency row", () => {
  const markup = renderMarkup(
    createElement(SettlementSummary, {
      data: {
        viewerMemberId: "alex",
        missingPayers: [],
        currencies: [
          {
            currency: "USD",
            members: [
              {
                memberId: "alex",
                name: "Alex",
                balance: -8,
                share: 44,
                includedIn: 4,
                paidFor: 3,
              },
              { memberId: "bea", name: "Bea", balance: 8, share: 0, includedIn: 0, paidFor: 0 },
            ],
          },
        ],
      },
      onMemberClick: vi.fn(),
    }),
  );

  expect(markup).toContain('aria-label="View Alex\'s USD balance breakdown"');
  expect(markup).toContain("border-y-2 border-forest");
  expect(markup).toContain('block text-xs text-ink-soft">You');
  expect(markup).toContain('class="flex min-w-0 items-center gap-3 text-left');
  expect(markup).toContain("relative bleed-px py-3");
  expect(markup).toContain("divide-y divide-rule border-b border-edge bg-field");
  expect(markup).toContain(">You</span>");
  expect(markup).toContain("Included in");
  expect(markup).toContain("Paid for");
  expect(markup).toContain("Spent");
  expect(markup).toContain("Balance");
  expect(markup).not.toContain(">USD</span>");
  expect(markup).not.toContain("grid w-full grid-cols-2");
  expect(markup.indexOf('aria-label="View Alex\'s USD balance breakdown"')).toBeLessThan(
    markup.indexOf("Bea"),
  );
  expect(markup).not.toContain("(you)");
});

test("keeps mixed viewer currencies together in one summary", () => {
  const markup = renderMarkup(
    createElement(SettlementSummary, {
      data: {
        ...viewerData,
        currencies: [
          { currency: "CAD", members: [{ memberId: "alex", name: "Alex", balance: 0 }] },
          { currency: "USD", members: [{ memberId: "alex", name: "Alex", balance: 0.5 }] },
        ],
      },
    }),
  );

  expect(markup).not.toContain("<table");
  expect(markup).not.toContain(">Member<");
  expect(markup).not.toContain('aria-label="CAD balances"');
  expect(markup).not.toContain('aria-label="USD balances"');
  expect(markup).toContain("You get ");
  expect(markup).not.toContain("Canadian Dollar");
  expect(markup).not.toContain("US Dollar");
  expect(markup.match(/aria-label="View Alex's (?:CAD|USD) balance breakdown"/g)).toHaveLength(2);
  expect(markup.match(/>You<\/span>/g)).toHaveLength(1);
});

test("shows every member while putting the viewer first", () => {
  const markup = renderMarkup(
    createElement(SettlementSummary, {
      data: {
        viewerMemberId: "alex",
        missingPayers: [],
        currencies: [
          {
            currency: "USD",
            suggestions: [
              { fromMemberId: "bea", toMemberId: "alex", amount: 5 },
              { fromMemberId: "cam", toMemberId: "alex", amount: 5 },
            ],
            members: [
              { memberId: "bea", name: "Bea", balance: -5 },
              { memberId: "alex", name: "Alex", balance: 10 },
              { memberId: "cam", name: "Cam", balance: -5 },
            ],
          },
        ],
      },
    }),
  );

  expect(markup.indexOf("Alex")).toBeLessThan(markup.indexOf("Bea"));
  expect(markup.indexOf("Alex")).toBeLessThan(markup.indexOf("Cam"));
  expect(markup).toContain(">You</span>");
  expect(markup).toContain("You get ");
  expect(markup).toContain("$10.00");
  expect(markup).toContain("Owes you ");
  expect(markup).not.toContain("You owe ");
});

test("shows each non-viewer balance only against the logged-in member", () => {
  const markup = renderMarkup(
    createElement(SettlementSummary, {
      data: {
        viewerMemberId: "nikki",
        missingPayers: [],
        currencies: [
          {
            currency: "USD",
            suggestions: [
              { fromMemberId: "p3", toMemberId: "nikki", amount: 3 },
              { fromMemberId: "p3", toMemberId: "p2", amount: 3 },
            ],
            members: [
              { memberId: "nikki", name: "Nikki Q", balance: 3 },
              { memberId: "p2", name: "P2", balance: 3 },
              { memberId: "p3", name: "P3", balance: -6 },
            ],
          },
        ],
      },
    }),
  );

  expect(markup).toContain("Owes you ");
  expect(markup).toContain("$3.00");
  expect(markup).toContain("P2");
  expect(markup).toContain("Settled");
  expect(markup).toContain('class="lucide lucide-check h-5 w-5"');
  expect(markup).toContain('<span class="text-xs font-normal text-ink-soft">Settled</span>');
  expect(markup).not.toContain("Owes you $6.00");
});

test("uses direct viewer balances for every non-viewer row", () => {
  const markup = renderMarkup(
    createElement(SettlementSummary, {
      data: {
        viewerMemberId: "nikki",
        missingPayers: [],
        currencies: [
          {
            currency: "USD",
            members: [
              { memberId: "nikki", name: "Nikki Q", balance: 12, balanceWithViewer: 12 },
              { memberId: "p2", name: "P2", balance: -3, balanceWithViewer: 6 },
              { memberId: "p3", name: "P3", balance: -9, balanceWithViewer: 6 },
            ],
          },
        ],
      },
    }),
  );

  expect(markup).toContain("You get ");
  expect(markup).toContain("$12.00");
  expect(markup.match(/Owes you <span[^>]*>\$6\.00<\/span>/g)).toHaveLength(2);
  expect(markup).not.toContain("$3.00");
  expect(markup).not.toContain("$9.00");
});

test("says You owe only when the viewer owes overall", () => {
  const markup = renderMarkup(
    createElement(SettlementSummary, {
      data: {
        viewerMemberId: "alex",
        missingPayers: [],
        currencies: [
          {
            currency: "USD",
            suggestions: [{ fromMemberId: "alex", toMemberId: "bea", amount: 10 }],
            members: [
              { memberId: "alex", name: "Alex", balance: -10 },
              { memberId: "bea", name: "Bea", balance: 10 },
            ],
          },
        ],
      },
    }),
  );

  expect(markup).toContain("You owe ");
  expect(markup).toContain("$10.00");
  expect(markup).not.toContain("You get ");
});

test("renders other members as one member card with rows for each currency", () => {
  const markup = renderMarkup(
    createElement(SettlementSummary, {
      data: {
        viewerMemberId: "alex",
        missingPayers: [],
        currencies: [
          {
            currency: "CAD",
            members: [
              { memberId: "alex", name: "Alex", balance: 10 },
              { memberId: "bea", name: "Bea", balance: -10 },
            ],
          },
          {
            currency: "USD",
            members: [
              { memberId: "alex", name: "Alex", balance: 2 },
              { memberId: "bea", name: "Bea", balance: -2 },
            ],
          },
        ],
      },
    }),
  );
  expect(markup).not.toContain("<table");
  expect(markup).not.toContain(">Member<");
  expect(markup).toContain("CAD");
  expect(markup.indexOf("Alex")).toBeLessThan(markup.indexOf("Bea"));
  expect(markup.match(/aria-label="Bea balances"/g)).toHaveLength(1);
  expect(markup.match(/aria-label="View Bea's (?:CAD|USD) balance breakdown"/g)).toHaveLength(2);
  expect(markup).toContain('class="bleed divide-y divide-edge border-b border-edge"');
  expect(markup).not.toContain('aria-label="Bea balances" class="-mx-5');
  expect(markup).not.toContain('aria-label="CAD balances"');
  expect(markup).not.toContain('aria-label="USD balances"');
});

test("uses the compact two-column mobile layout for every multi-currency member row", () => {
  const markup = renderMarkup(
    createElement(SettlementSummary, {
      data: {
        viewerMemberId: "alex",
        missingPayers: [],
        currencies: [
          {
            currency: "CAD",
            members: [
              {
                memberId: "alex",
                name: "Alex",
                balance: -3,
                share: 20,
                includedIn: 2,
                paidFor: 1,
              },
              {
                memberId: "bea",
                name: "Bea",
                balance: 3,
                share: 10,
                includedIn: 1,
                paidFor: 0,
              },
            ],
          },
          {
            currency: "USD",
            members: [
              {
                memberId: "alex",
                name: "Alex",
                balance: 1,
                share: 5,
                includedIn: 1,
                paidFor: 0,
              },
              {
                memberId: "bea",
                name: "Bea",
                balance: -1,
                share: 4,
                includedIn: 1,
                paidFor: 1,
              },
            ],
          },
        ],
      },
    }),
  );

  expect(
    markup.match(/@max-\[37\.99rem\]:grid-cols-\[minmax\(0,1fr\)_minmax\(0,1fr\)\]/g),
  ).toHaveLength(4);
  expect(
    markup.match(/flex min-w-0 max-w-full flex-col items-end break-words text-right/g),
  ).toHaveLength(4);
  expect(markup).toContain("@min-[38rem]:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]");
  expect(markup).toContain("w-full bg-field px-5 py-3");
  expect(markup).not.toContain("border-y-2 border-forest bg-field");
  expect(markup).toContain("minmax(0,.65fr)");
  expect(markup).toContain("minmax(0,1.5fr)");
  expect(markup).toContain("@max-[44rem]:[&amp;_.font-numeric]:block");
  expect(markup).toContain("h-8 w-8 text-xs");
  expect(markup).toContain("text-sm");
  expect(markup).toContain("block text-xs font-normal text-ink-soft");
  expect(markup).toContain("break-words text-sm font-semibold text-ink");
  expect(markup).toContain('@min-[38rem]:hidden">Included in ');
  expect(markup).toContain('@min-[38rem]:hidden">Paid for ');
  expect(markup).toContain("gap-y-1 text-xs text-ink-soft");
  expect(markup).toContain("@min-[38rem]:text-sm");
  expect(markup).toContain("border-b border-rule px-5 py-4");
  expect(markup).toContain("@min-[38rem]:border-b-0");
  expect(markup).toContain("w-full bg-field px-5 py-3");
  expect(markup).toContain("@min-[38rem]:px-6");
  expect(markup).toContain("box-border min-h-11 min-w-0 w-full bg-field px-5 py-3");
  expect(markup).toContain("box-border w-full px-6 py-2");
  expect(markup).not.toContain('aria-label="Alex balances" class="-mx-5');
});

test("keeps the compact member rows for a single currency", () => {
  const markup = renderMarkup(
    createElement(SettlementSummary, {
      data: {
        viewerMemberId: "alex",
        missingPayers: [],
        currencies: [
          {
            currency: "CAD",
            members: [
              { memberId: "alex", name: "Alex", balance: -8, share: 44 },
              { memberId: "bea", name: "Bea", balance: 8, share: 29 },
            ],
          },
        ],
      },
    }),
  );

  expect(markup).toContain('aria-label="CAD balances"');
  expect(markup).not.toContain('aria-label="Bea balances"');
  expect(markup).toContain("bleed-px py-3");
});

test("routes a member currency row click with that member and currency", () => {
  const onMemberClick = vi.fn();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() =>
    root.render(
      createElement(SettlementSummary, {
        data: {
          viewerMemberId: "alex",
          missingPayers: [],
          currencies: [
            {
              currency: "CAD",
              members: [
                { memberId: "alex", name: "Alex", balance: 0 },
                { memberId: "bea", name: "Bea", balance: 1 },
              ],
            },
            {
              currency: "USD",
              members: [
                { memberId: "alex", name: "Alex", balance: 0 },
                { memberId: "bea", name: "Bea", balance: 2 },
              ],
            },
          ],
        },
        onMemberClick,
      }),
    ),
  );

  container
    .querySelector<HTMLButtonElement>('button[aria-label="View Bea\'s USD balance breakdown"]')
    ?.click();
  expect(onMemberClick).toHaveBeenCalledWith("bea", "USD");
  flushSync(() => root.unmount());
  container.remove();
});

test("renders one shared header above all mixed-currency member rows", () => {
  const markup = renderMarkup(
    createElement(SettlementSummary, {
      data: {
        viewerMemberId: "alex",
        missingPayers: [],
        currencies: [
          {
            currency: "CAD",
            members: [
              { memberId: "alex", name: "Alex", balance: 0, share: 42.39, paidFor: 1 },
              { memberId: "bea", name: "Bea", balance: 0, share: 42.4, paidFor: 0 },
            ],
          },
          {
            currency: "USD",
            members: [
              { memberId: "alex", name: "Alex", balance: 0.5, share: 0.5, paidFor: 0 },
              { memberId: "bea", name: "Bea", balance: -0.5, share: 0, paidFor: 1 },
            ],
          },
        ],
      },
    }),
  );

  expect(markup).not.toContain(">Member<");
  expect(markup).toContain("Paid for");
  expect(markup.indexOf(">Paid for<")).toBeLessThan(markup.indexOf(">Spent<"));
  expect(markup).toContain("hidden border-y border-rule bg-surface");
  expect(markup).toContain("1</span> expense");
  expect(markup).toContain(">0</span> expenses");
  expect(markup).toContain(">Spent<");
  expect(markup).toContain("You get ");
  expect(markup).not.toContain(">You owe<");
  expect(markup.match(/>Balance</g)).toHaveLength(1);
  expect(markup.indexOf(">Balance</span>")).toBeLessThan(
    markup.indexOf('aria-label="View Alex\'s CAD balance breakdown"'),
  );
  expect(markup).toContain(
    'class="hidden min-w-0 break-words text-right font-numeric font-semibold text-ink @min-[38rem]:block"',
  );
  expect(markup).toContain("CA$42.39");
  expect(markup).toContain("CA$42.40");
  expect(markup).toContain("$0.50");
  expect(markup).not.toContain("Canadian Dollar");
  expect(markup).not.toContain("US Dollar");
  expect(markup.match(/aria-label="View (?:Alex|Bea)'s CAD balance breakdown"/g)).toHaveLength(2);
  expect(markup.match(/aria-label="View (?:Alex|Bea)'s USD balance breakdown"/g)).toHaveLength(2);
});

test("omits zero-only currency rows and keeps sparse nonzero rows", () => {
  const markup = renderMarkup(
    createElement(SettlementSummary, {
      data: {
        viewerMemberId: "alex",
        missingPayers: [],
        currencies: [
          {
            currency: "CAD",
            members: [{ memberId: "alex", name: "Alex", balance: 0, share: 10 }],
          },
          {
            currency: "USD",
            members: [{ memberId: "bea", name: "Bea", balance: -2, share: 0 }],
          },
        ],
      },
    }),
  );

  expect(markup).toContain("CAD");
  expect(markup).toContain("USD");
  expect(markup).toContain("Bea");
  expect(markup).toContain("No expenses");
});

test("shows incomplete, empty, viewer-free, and loading settlement states", () => {
  expect(
    renderMarkup(
      createElement(SettlementSummary, {
        data: { ...viewerData, missingPayers: [{ slug: "dinner", name: "Dinner" }] },
      }),
    ),
  ).toContain("Balances incomplete: payer needed");
  expect(
    renderMarkup(
      createElement(SettlementSummary, { data: { ...viewerData, viewerMemberId: null } }),
    ),
  ).toContain("View balances and payments");
  expect(
    renderMarkup(createElement(SettlementSummary, { data: { ...viewerData, currencies: [] } })),
  ).toContain("No outstanding balances.");
  expect(
    renderMarkup(createElement(TabSettlement, { slug: "trip", members: [], isOwner: false })),
  ).toContain("Loading settlement balances…");
});

test("retains payment history controls for upcoming balances", () => {
  const upcoming = {
    ...viewerData,
    history: [],
    currencies: viewerData.currencies.map((group) => ({ ...group, suggestions: [] })),
  };
  mocks.remote = { paid: upcoming, upcoming, all: upcoming };

  const markup = renderMarkup(
    createElement(TabSettlement, {
      slug: "trip",
      members: [],
      isOwner: false,
      expenseView: "upcoming",
    }),
  );

  expect(markup).not.toContain("Expected balances from upcoming expenses");
  expect(markup).toContain("View payments");
  expect(markup).toContain("w-full @min-[38rem]:w-auto");
  expect(markup).toContain("@min-[38rem]:hidden");
  expect(markup).toContain("@min-[38rem]:inline-flex");
});

test("renders the viewer row inside the balances panel under the shared header", () => {
  const settlement = {
    ...viewerData,
    history: [],
    currencies: [
      {
        currency: "USD",
        members: [
          { memberId: "alex", name: "Alex", balance: -8, share: 44 },
          { memberId: "bea", name: "Bea", balance: 8, share: 0 },
        ],
      },
    ],
  };
  mocks.remote = { paid: settlement, upcoming: settlement, all: settlement };

  const markup = renderMarkup(
    createElement(TabSettlement, { slug: "trip", members: [], isOwner: false }),
  );
  const viewerCard = markup.indexOf('aria-label="View Alex\'s USD balance breakdown"');
  const balancesPanel = markup.indexOf('aria-label="Balances"');
  const balancesTitle = markup.indexOf(">Balances<", balancesPanel);
  const sharedHeader = markup.indexOf(">Included in<", balancesTitle);
  const otherMember = markup.indexOf(">Bea</span>", balancesPanel);

  expect(viewerCard).toBeGreaterThanOrEqual(0);
  expect(viewerCard).toBeGreaterThan(balancesPanel);
  expect(viewerCard).toBeGreaterThan(balancesTitle);
  expect(viewerCard).toBeGreaterThan(sharedHeader);
  expect(markup).toContain(
    'class="rounded-full bg-forest/10 px-2 py-0.5 font-numeric text-xs font-semibold text-ink">USD</span>',
  );
  expect(markup).toContain("border-y-2 border-forest");
  expect(otherMember).toBeGreaterThan(viewerCard);
});

test("renders the multi-currency viewer summary inside the balances panel", () => {
  const settlement = {
    ...viewerData,
    history: [],
    currencies: [
      {
        currency: "USD",
        members: [
          { memberId: "alex", name: "Alex", balance: -8, share: 44 },
          { memberId: "bea", name: "Bea", balance: 8, share: 0 },
        ],
      },
      {
        currency: "CAD",
        members: [
          { memberId: "alex", name: "Alex", balance: -5, share: 25 },
          { memberId: "bea", name: "Bea", balance: 5, share: 0 },
        ],
      },
    ],
  };
  mocks.remote = { paid: settlement, upcoming: settlement, all: settlement };

  const markup = renderMarkup(
    createElement(TabSettlement, { slug: "trip", members: [], isOwner: false }),
  );
  const balancesPanel = markup.indexOf('aria-label="Balances"');
  const balancesTitle = markup.indexOf(">Balances<", balancesPanel);
  const viewerCard = markup.indexOf('aria-label="View Alex\'s USD balance breakdown"');
  const otherMember = markup.indexOf(">Bea</span>", balancesPanel);

  expect(markup).not.toContain("rounded-full bg-forest/10 px-2 py-0.5 font-numeric");

  expect(viewerCard).toBeGreaterThan(balancesPanel);
  expect(viewerCard).toBeGreaterThan(balancesTitle);
  expect(markup.indexOf('aria-label="View Alex\'s CAD balance breakdown"')).toBeGreaterThan(
    balancesPanel,
  );
  expect(markup.slice(balancesPanel, viewerCard)).toContain('class="bleed mb-0 [&amp;>*]:mx-0"');
  expect(markup).toContain("text-margin-red-ink break-words");
  expect(otherMember).toBeGreaterThan(viewerCard);
});

test("loads the member breakdown using the active view and as-of date", () => {
  const upcoming = {
    ...viewerData,
    history: [],
    currencies: viewerData.currencies.map((group) => ({ ...group, suggestions: [] })),
  };
  mocks.remote = { paid: upcoming, upcoming, all: upcoming };

  renderMarkup(
    createElement(TabSettlement, {
      slug: "trip",
      members: [],
      isOwner: false,
      expenseView: "upcoming",
    }),
  );

  expect(mocks.query).toHaveBeenCalledTimes(2);
  expect(mocks.query.mock.calls[1][1]).toMatchObject({
    slug: "trip",
    view: "upcoming",
    asOfDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
  });
});

test("renders a legacy settlement response while the consolidated query deploys", () => {
  mocks.remote = {
    ...viewerData,
    history: [],
    currencies: viewerData.currencies.map((group) => ({ ...group, suggestions: [] })),
  };

  const markup = renderMarkup(
    createElement(TabSettlement, { slug: "trip", members: [], isOwner: false }),
  );

  expect(markup).toContain('aria-label="View Alex\'s CAD balance breakdown"');
});

test("shows what each member spent beside their balance, and totals the column", () => {
  const markup = renderMarkup(
    createElement(SettlementSummary, {
      data: {
        viewerMemberId: "alex",
        missingPayers: [],
        currencies: [
          {
            currency: "CAD",
            members: [
              { memberId: "alex", name: "Alex", balance: 0, share: 42.39 },
              {
                memberId: "bea",
                name: "Bea",
                balance: 42.4,
                balanceWithViewer: 42.4,
                share: 42.4,
              },
              { memberId: "cam", name: "Cam", balance: -42.4, share: 42.4 },
            ],
          },
        ],
      },
    }),
  );

  expect(markup).toContain("Spent");
  expect(markup).toContain("Balance");
  expect(markup).toContain("CA$42.39");
  expect(markup).toContain('<span class="text-xs text-ink-soft">Spent</span>');
  expect(markup).toContain("CA$42.40");
  expect(markup).toContain(">Owes you</span>");
  expect(markup).toContain("+CA$42.40");
  // Without a direct suggestion, a non-viewer row is settled with the viewer.
  expect(markup).toContain("Settled");
  expect(markup).not.toContain("You owe ");
});

test("a member with no share in a currency reads as no expenses, not zero", () => {
  const markup = renderMarkup(
    createElement(SettlementSummary, {
      data: {
        viewerMemberId: "alex",
        missingPayers: [],
        currencies: [
          {
            currency: "USD",
            members: [
              { memberId: "alex", name: "Alex", balance: 0.5, share: 0.5 },
              { memberId: "cam", name: "Cam", balance: 0, share: 0 },
            ],
          },
        ],
      },
    }),
  );

  expect(markup).toContain("No expenses");
  expect(markup).not.toContain("$0.00");
});

test("shows None for members who have never shared an expense with the viewer", () => {
  const member = {
    memberId: "bea",
    name: "Bea",
    balance: 0,
    balanceWithViewer: 0,
    hasSharedExpenseWithViewer: false,
    share: 0,
  };
  const single = renderMarkup(
    createElement(SettlementSummary, {
      data: {
        viewerMemberId: "alex",
        missingPayers: [],
        currencies: [
          {
            currency: "CAD",
            members: [{ memberId: "alex", name: "Alex", balance: 0, share: 0 }, member],
          },
        ],
      },
    }),
  );
  const multi = renderMarkup(
    createElement(SettlementSummary, {
      data: {
        viewerMemberId: "alex",
        missingPayers: [],
        currencies: [
          {
            currency: "CAD",
            members: [{ memberId: "alex", name: "Alex", balance: 0, share: 0 }, member],
          },
          {
            currency: "USD",
            members: [{ memberId: "alex", name: "Alex", balance: 0, share: 0 }, member],
          },
        ],
      },
    }),
  );

  for (const markup of [single, multi]) {
    expect(markup).toContain('class="lucide lucide-circle-minus h-5 w-5"');
    expect(markup).toContain(">None</span>");
  }
});

test("shows paid-for counts before spent in a single-currency table", () => {
  const markup = renderMarkup(
    createElement(SettlementSummary, {
      data: {
        viewerMemberId: "alex",
        missingPayers: [],
        currencies: [
          {
            currency: "USD",
            members: [
              { memberId: "alex", name: "Alex", balance: 1, share: 2, paidFor: 1 },
              { memberId: "bea", name: "Bea", balance: -1, share: 0, paidFor: 0 },
            ],
          },
        ],
      },
    }),
  );

  expect(markup.indexOf(">Paid for<")).toBeLessThan(markup.indexOf(">Spent<"));
  expect(markup).toContain("1</span> expense");
  expect(markup).toContain(">-</span>");
  expect(markup).toContain('aria-label="USD balances"');
  expect(markup).not.toContain('<span class="font-numeric">USD</span>');
  expect(markup).toContain(
    "hidden bleed-px border-t border-rule pt-2 pb-0 text-xs @min-[38rem]:grid",
  );
  expect(markup).toContain("divide-y divide-rule border-b border-edge bg-field");
});

test("shows included-in counts before paid-for counts", () => {
  const markup = renderMarkup(
    createElement(SettlementSummary, {
      data: {
        viewerMemberId: "alex",
        missingPayers: [],
        currencies: [
          {
            currency: "USD",
            members: [
              { memberId: "alex", name: "Alex", balance: 1, share: 2, includedIn: 2, paidFor: 1 },
              { memberId: "bea", name: "Bea", balance: -1, share: 0, includedIn: 0, paidFor: 0 },
            ],
          },
        ],
      },
    }),
  );

  expect(markup.indexOf(">Included in<")).toBeLessThan(markup.indexOf(">Paid for<"));
  expect(markup).toContain("2</span> expenses");
  expect(markup).toContain(">-</span>");
});

test("keeps member counts readable on narrow layouts", () => {
  const markup = renderMarkup(
    createElement(SettlementSummary, {
      data: {
        viewerMemberId: "alex",
        missingPayers: [],
        currencies: [
          {
            currency: "USD",
            members: [
              { memberId: "alex", name: "Alex", balance: 1, includedIn: 2, paidFor: 1 },
              { memberId: "bea", name: "Bea", balance: -1, includedIn: 0, paidFor: 0 },
            ],
          },
        ],
      },
    }),
  );

  expect(markup).toContain(">Included in</span>");
  expect(markup).toContain(">2</span> expenses");
  expect(markup).toContain(">Paid for</span>");
  expect(markup).toContain(">1</span> expense");
  expect(markup).toContain("Included in 0 expenses");
  expect(markup).toContain("Paid for 0 expenses");
});

test("drops the spend column for a response that predates it", () => {
  // `viewerData` has no `share`, standing in for a client open across the
  // rollout. That should cost the column, not render one full of blanks.
  const markup = renderMarkup(createElement(SettlementSummary, { data: viewerData }));

  expect(markup).not.toContain("Total spent");
  expect(markup).not.toContain(">Spent<");
  expect(markup).toContain("You get ");
});
