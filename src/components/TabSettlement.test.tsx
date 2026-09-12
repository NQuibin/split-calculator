// @vitest-environment node
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ remote: undefined as unknown, mutation: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery: () => mocks.remote, useMutation: () => mocks.mutation }));

import { SettlementSummary, TabSettlement, type SettlementSummaryData } from "./TabSettlement";

afterEach(() => { mocks.remote = undefined; vi.clearAllMocks(); });

const viewerData: SettlementSummaryData = {
  viewerMemberId: "alex",
  missingPayers: [],
  currencies: [
    { currency: "CAD", members: [{ memberId: "alex", balance: 7.34 }] },
    { currency: "USD", members: [{ memberId: "alex", balance: -0.5 }] },
  ],
};

test("renders each viewer currency once with its own balance", () => {
  const markup = renderToStaticMarkup(createElement(SettlementSummary, { data: viewerData }));
  expect(markup).toContain("CAD");
  expect(markup).toContain("Gets ");
  expect(markup).toContain("USD");
  expect(markup).toContain("Owes ");
  expect(markup.match(/CA\$7\.34/g)).toHaveLength(1);
  expect(markup.match(/\$0\.50/g)).toHaveLength(1);
});

test("centers mixed settled and outstanding currency summaries", () => {
  const markup = renderToStaticMarkup(createElement(SettlementSummary, { data: {
    ...viewerData,
    currencies: [
      { currency: "CAD", members: [{ memberId: "alex", balance: 0 }] },
      { currency: "USD", members: [{ memberId: "alex", balance: 0.5 }] },
    ],
  } }));

  expect(markup).toContain('class="flex flex-wrap items-center gap-x-6 gap-y-2"');
  expect(markup.match(/class="inline-flex items-center gap-2"/g)).toHaveLength(2);
  expect(markup).toContain("Settled");
  expect(markup).toContain("Gets ");
  expect(markup).toContain("text-ink text-lg font-semibold");
});

test("shows incomplete, empty, viewer-free, and loading settlement states", () => {
  expect(renderToStaticMarkup(createElement(SettlementSummary, { data: { ...viewerData, missingPayers: [{ slug: "dinner", name: "Dinner" }] } }))).toContain("Balances incomplete: payer needed");
  expect(renderToStaticMarkup(createElement(SettlementSummary, { data: { ...viewerData, viewerMemberId: null } }))).toContain("View balances and payments");
  expect(renderToStaticMarkup(createElement(SettlementSummary, { data: { ...viewerData, currencies: [] } }))).toContain("No outstanding balances.");
  expect(renderToStaticMarkup(createElement(TabSettlement, { slug: "trip", members: [], isOwner: false }))).toContain("Loading settlement balances…");
});
