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
  expect(markup).toContain('aria-label="CAD balances"');
  expect(markup).toContain('aria-label="USD balances"');
  expect(markup).toContain("Settled");
  expect(markup).toContain("Gets ");
  expect(markup).toContain("text-ink font-semibold");
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
  expect(markup).toContain('class="space-y-5"');
  expect(markup).toContain("CAD");
  expect(markup).toContain("Canadian Dollar");
  expect(markup.indexOf("Alex")).toBeLessThan(markup.indexOf("Bea"));
  expect(markup).toContain('aria-label="CAD balances"');
  expect(markup).toContain('aria-label="USD balances"');
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

test("labels upcoming balances as expected while retaining payment history", () => {
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

  expect(markup).toContain("Expected balances from upcoming expenses");
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

  expect(markup).toContain('aria-label="CAD balances"');
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
  expect(markup).toContain("Settled");
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

test("drops the spend column for a response that predates it", () => {
  // `viewerData` has no `share`, standing in for a client open across the
  // rollout. That should cost the column, not render one full of blanks.
  const markup = renderMarkup(createElement(SettlementSummary, { data: viewerData }));

  expect(markup).not.toContain("Total spent");
  expect(markup).not.toContain(">Spent<");
  expect(markup).toContain("Gets ");
});
