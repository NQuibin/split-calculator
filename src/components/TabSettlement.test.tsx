// @vitest-environment happy-dom
import { createElement, type ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { renderMarkup } from "@/test/render";

const mocks = vi.hoisted(() => ({ remote: undefined as unknown, mutation: vi.fn() }));
vi.mock("convex/react", () => ({
  useQuery: () => mocks.remote,
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
  expect(markup.match(/CA\$7\.34/g)).toHaveLength(1);
  expect(markup.match(/\$0\.50/g)).toHaveLength(1);
});

test("uses currency bands for mixed settled and outstanding balances", () => {
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
  expect(markup).not.toContain("text-lg font-semibold");
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
  expect(markup).toContain("> (you)</span>");
  expect(markup).toContain("You get ");
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

  expect(markup).toMatch(/You get <span[^>]*>\$12\.00<\/span>/);
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
  expect(markup).not.toContain("You get ");
});

test("renders all members in each currency band", () => {
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
  expect(markup).not.toContain('aria-label="CAD balances"');
  expect(markup).not.toContain('aria-label="USD balances"');
  expect(markup.match(/aria-haspopup="dialog"/g)).toHaveLength(4);
});

test("consolidates mixed currencies into member blocks with currency-aware totals", () => {
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
  expect(markup).toContain("1</span> expense");
  expect(markup).toContain(">-</span>");
  expect(markup).toContain(">Spent<");
  expect(markup).toContain(">You get<");
  expect(markup).not.toContain(">You owe<");
  expect(markup.match(/>Balance</g)).toHaveLength(1);
  expect(markup).toContain("CA$42.39");
  expect(markup).toContain("CA$42.40");
  expect(markup).toContain("$0.50");
  expect(markup).not.toContain("Total spent");
  // Alex's settled CAD row is omitted only when it has no spend; the USD row
  // remains because it carries a non-zero balance.
  expect(markup.match(/font-numeric text-sm font-semibold text-ink">CAD</g)).toHaveLength(2);
  expect(markup.match(/font-numeric text-sm font-semibold text-ink">USD</g)).toHaveLength(2);
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

  expect(markup).not.toContain('aria-label="CAD balances"');
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
              { memberId: "bea", name: "Bea", balance: 42.4, share: 42.4 },
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
  expect(markup).not.toContain("Total spent");
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

test("shows paid-for counts before spent, with a dash for no paid expenses", () => {
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

test("shows mobile member counts, including zero counts", () => {
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

  expect(markup).toContain("Included in 2 expenses");
  expect(markup).toContain("Paid for 1 expense");
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
