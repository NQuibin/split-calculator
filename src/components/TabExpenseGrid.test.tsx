// @vitest-environment happy-dom
import { createElement } from "react";
import { expect, test } from "vitest";
import { renderMarkup } from "@/test/render";
import { TabExpenseRow } from "./TabExpenseGrid";

const sharedRow = {
  name: "Dinner",
  date: "2026-09-08",
  total: 20,
  code: "CAD",
  payer: { id: "member-1", name: "Nikki Q" },
  upcoming: false,
  onExpenseClick: () => undefined,
};

test("renders only the viewer balance through the shared row", () => {
  const markup = renderMarkup(
    createElement(TabExpenseRow, {
      ...sharedRow,
      memberContext: { balance: 13.34 },
    }),
  );

  expect(markup).not.toContain("You spent");
  expect(markup).toContain("Nikki Q");
  expect(markup).toContain(">covered</span>");
  expect(markup).not.toContain(">paid</span>");
  expect(markup).toContain("You are owed");
  expect(markup).toContain("CA$13.34");
  expect(markup).toContain("hover:bg-wash");
  expect(markup).toContain("active:bg-wash");
  expect(markup).toContain("chevron-x");
  expect(markup).toContain("-mr-1");
  expect(markup).toContain("grid-cols-[4rem_minmax(0,1fr)_fit-content(9.5rem)]");
  expect(markup).toContain("focus-visible:after:outline-forest");
  expect(markup).toContain('class="flex min-w-0 flex-col items-start gap-y-0.5"');
  expect(markup).toContain("col-start-1 col-span-2 row-start-1");
  expect(markup).toContain("col-start-3 row-start-2");
  expect(markup).toContain('class="block text-sm text-ink-soft">You are owed');
  expect(markup).toContain("@min-[38rem]:col-start-3 @min-[38rem]:flex");
  expect(markup).toContain('class="flex min-w-0 flex-wrap items-baseline gap-x-1 gap-y-0.5"');
  expect(markup).toContain('class="font-numeric text-sm">CA$20.00');
});

test("renders another selected member's balance label", () => {
  const markup = renderMarkup(
    createElement(TabExpenseRow, {
      ...sharedRow,
      memberContext: { balance: -6.66, memberName: "Pat" },
    }),
  );

  expect(markup).not.toContain("Pat spent");
  expect(markup).toContain("Pat owes");
  expect(markup).not.toContain("You spent");
  expect(markup).not.toContain("You owe");
});

test.each([
  ["settled", "Paid", "Repaid", "bg-settled-chip text-forest"],
  [
    "partiallySettled",
    "Partially paid",
    "Partially repaid",
    "bg-partially-settled-chip text-brass-ink",
  ],
] as const)(
  "renders %s with role-aware settlement labels",
  (settlementStatus, debtorLabel, payerLabel, colors) => {
    const markup = renderMarkup(
      createElement(TabExpenseRow, {
        ...sharedRow,
        memberContext: { balance: 13.34 },
        settlementStatus,
      }),
    );

    expect(markup).toContain(debtorLabel);
    const coveringMarkup = renderMarkup(
      createElement(TabExpenseRow, {
        ...sharedRow,
        memberContext: { balance: -13.34, coversExpense: true },
        settlementStatus,
      }),
    );
    expect(coveringMarkup).toContain(payerLabel);
    expect(markup).toContain(
      `class="mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors}"`,
    );
  },
);

test.each([undefined, "outstanding"] as const)(
  "does not render a settlement pill for %s",
  (settlementStatus) => {
    const markup = renderMarkup(
      createElement(TabExpenseRow, {
        ...sharedRow,
        memberContext: { balance: 13.34 },
        settlementStatus,
      }),
    );

    expect(markup).not.toContain("Paid");
    expect(markup).not.toContain("Partially paid");
    expect(markup).not.toContain("bg-settled-chip");
    expect(markup).not.toContain("bg-partially-settled-chip");
  },
);

test("omits the balance column when no member context is supplied", () => {
  const markup = renderMarkup(createElement(TabExpenseRow, sharedRow));

  expect(markup).not.toContain("You are owed");
  expect(markup).not.toContain("Not in split");
  expect(markup).not.toContain(">Balance<");
});

test("renders a zero balance without an icon", () => {
  const markup = renderMarkup(
    createElement(TabExpenseRow, {
      ...sharedRow,
      memberContext: { balance: 0 },
    }),
  );

  expect(markup).toContain("No balance");
  expect(markup).not.toContain("lucide-check");
});

test("styles an upcoming zero balance like No balance", () => {
  const markup = renderMarkup(
    createElement(TabExpenseRow, {
      ...sharedRow,
      upcoming: true,
      memberContext: { balance: 0 },
    }),
  );

  expect(markup).toContain(
    '<span class="ml-auto block w-20 shrink-0 text-right text-sm text-ink-soft">Not due</span>',
  );
});

test("uses covered wording for planned expense funding", () => {
  const markup = renderMarkup(
    createElement(TabExpenseRow, {
      ...sharedRow,
      payer: undefined,
      upcoming: true,
    }),
  );

  expect(markup).toContain("Not covered yet");
});

test("renders No balance when the viewer did not participate in the expense", () => {
  const markup = renderMarkup(
    createElement(TabExpenseRow, {
      ...sharedRow,
      memberContext: { balance: undefined, viewerPerspective: true },
    }),
  );

  expect(markup).toContain("No balance");
  expect(markup).not.toContain("lucide-circle-minus");
  expect(markup).not.toContain("Not in split");
});

test.each([
  [12, "Are owed", "text-ledger-green"],
  [-12, "Owe", "text-margin-red-ink"],
] as const)("renders a read-only selected-member row for %s", (balance, label, color) => {
  const markup = renderMarkup(
    createElement(TabExpenseRow, {
      ...sharedRow,
      onExpenseClick: undefined,
      shareAmount: 8,
      memberContext: { balance, neutralPerspective: true },
    }),
  );

  expect(markup).toContain(label);
  expect(markup).toContain(color);
  expect(markup).toContain("CA$8.00");
  expect(markup).not.toContain("You are owed");
  expect(markup).not.toContain("You owe");
  expect(markup).not.toContain("<button");
  expect(markup).not.toContain("chevron-x");
  expect(markup).not.toContain("hover:bg-wash");
});
