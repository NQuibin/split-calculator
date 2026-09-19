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
  expect(markup).toContain("Gets ");
  expect(markup).toContain("USD");
  expect(markup).toContain("Owes ");
  expect(markup.match(/CA\$7\.34/g)).toHaveLength(2);
  expect(markup.match(/\$0\.50/g)).toHaveLength(2);
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
  expect(markup).toContain("Gets ");
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
  expect(markup).toContain("Gets ");
  expect(markup.match(/Owes /g)).toHaveLength(2);
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
  expect(markup.match(/>Spent</g)).toHaveLength(1);
  expect(markup.match(/>Balance</g)).toHaveLength(1);
  expect(markup).toContain("CA$42.39");
  expect(markup).toContain("CA$42.40");
  expect(markup).toContain("$0.50");
  expect(markup).toContain("Total spent");
  expect(markup).toContain("CA$84.79");
  expect(markup).toContain("$1.00");
  // Alex's settled CAD row is omitted only when it has no spend; the USD row
  // remains because it carries a non-zero balance.
  expect(markup.match(/font-numeric font-semibold text-ink">CAD</g)).toHaveLength(2);
  expect(markup.match(/font-numeric font-semibold text-ink">USD</g)).toHaveLength(2);
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
  // The footer totals the spend column only - balances always net to zero.
  expect(markup).toContain("Total spent");
  expect(markup).toContain("CA$127.19");
  // Both ledgers still read on the same row.
  expect(markup).toContain("Gets ");
  expect(markup).toContain("Owes ");
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

test("drops the spend column for a response that predates it", () => {
  // `viewerData` has no `share`, standing in for a client open across the
  // rollout. That should cost the column, not render one full of blanks.
  const markup = renderMarkup(createElement(SettlementSummary, { data: viewerData }));

  expect(markup).not.toContain("Total spent");
  expect(markup).not.toContain(">Spent<");
  expect(markup).toContain("Gets ");
});
