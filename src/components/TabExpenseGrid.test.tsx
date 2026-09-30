// @vitest-environment happy-dom
import { createElement } from "react";
import { expect, test } from "vitest";
import { renderMarkup } from "@/test/render";
import { TabExpenseHeader, TabExpenseRow } from "./TabExpenseGrid";

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
  expect(markup).toContain("You lent");
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
  expect(markup).toContain('class="block text-xs text-ink-soft">You lent');
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
  expect(markup).not.toContain("You borrowed");
});

test("omits the balance column when no member context is supplied", () => {
  const markup = renderMarkup(createElement(TabExpenseRow, sharedRow));
  const header = renderMarkup(createElement(TabExpenseHeader, { showBalance: false }));

  expect(markup).not.toContain("You lent");
  expect(markup).not.toContain("Not in split");
  expect(header).not.toContain(">Balance<");
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
    '<span class="ml-auto block w-20 shrink-0 text-right text-xs text-ink-soft">Not due</span>',
  );
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
