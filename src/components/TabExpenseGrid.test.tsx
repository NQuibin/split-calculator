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

test("renders viewer spent and balance labels through the shared row", () => {
  const markup = renderMarkup(
    createElement(TabExpenseRow, {
      ...sharedRow,
      memberContext: { balance: 13.34, spent: 20 },
    }),
  );

  expect(markup).toContain("You spent");
  expect(markup).toContain("You get");
  expect(markup).toContain("CA$20.00");
  expect(markup).toContain("CA$13.34");
  expect(markup).toContain("hover:bg-wash");
  expect(markup).toContain("focus-visible:after:outline-forest");
  expect(markup).toContain('class="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1"');
  expect(markup).toContain('class="mt-2 block text-xs text-ink-soft">You get');
});

test("renders another selected member's spent and balance labels", () => {
  const markup = renderMarkup(
    createElement(TabExpenseRow, {
      ...sharedRow,
      memberContext: { balance: -6.66, memberName: "Pat", spent: 20 },
    }),
  );

  expect(markup).toContain("Pat spent");
  expect(markup).toContain("Pat owes");
  expect(markup).not.toContain("You spent");
  expect(markup).not.toContain("You owe");
});

test("omits the balance column when no member context is supplied", () => {
  const markup = renderMarkup(createElement(TabExpenseRow, sharedRow));
  const header = renderMarkup(createElement(TabExpenseHeader, { showBalance: false }));

  expect(markup).not.toContain("You get");
  expect(markup).not.toContain("Not in split");
  expect(header).not.toContain(">Balance<");
});

test("renders settled balance as a 20px check with its label underneath", () => {
  const markup = renderMarkup(
    createElement(TabExpenseRow, {
      ...sharedRow,
      memberContext: { balance: 0 },
    }),
  );

  expect(markup).toContain('class="lucide lucide-check h-5 w-5"');
  expect(markup).toContain('<span class="text-xs text-ink-soft">Settled</span>');
  expect(markup).not.toContain("lucide-banknote-check");
});
