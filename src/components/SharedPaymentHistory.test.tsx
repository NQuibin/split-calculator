// @vitest-environment happy-dom
import { createElement } from "react";
import { expect, test } from "vitest";
import { renderMarkup } from "@/test/render";
import { SharedPaymentHistory } from "./SharedPaymentHistory";

const history = [
  {
    key: "payment-1" as never,
    fromMemberId: "member-a" as never,
    toMemberId: "member-b" as never,
    from: "Alex",
    to: "Nikki",
    amount: 12.5,
    currency: "CAD",
    date: "2026-09-05",
    reversed: true,
    isReversal: false,
    reversedAt: 1,
    note: "Dinner",
  },
  {
    key: "payment-2" as never,
    fromMemberId: "member-b" as never,
    toMemberId: "member-a" as never,
    from: "Nikki",
    to: "Alex",
    amount: 12.5,
    currency: "CAD",
    date: "2026-09-05",
    reversed: false,
    isReversal: true,
    reversedAt: undefined,
    note: "Correction",
  },
  {
    key: "payment-3" as never,
    fromMemberId: "member-c" as never,
    toMemberId: "member-a" as never,
    from: "Sam",
    to: "Nikki",
    amount: 8,
    currency: "USD",
    date: "2026-09-04",
    reversed: false,
    isReversal: false,
    reversedAt: undefined,
    note: undefined,
  },
];

test("renders read-only payment history grouped by date and currency", () => {
  const markup = renderMarkup(createElement(SharedPaymentHistory, { history }));

  expect(markup).toContain("3 recorded payments.");
  expect(markup.match(/Alex<\/span> → <span class="font-medium">Nikki/gu)).toHaveLength(2);
  expect(markup).toContain("Dinner");
  expect(markup).toContain("Correction");
  expect(markup).toContain("Reversed");
  expect(markup).toContain("Payment reversal");
  expect(markup.match(/>CAD<|>USD</gu)).toHaveLength(2);
  expect(markup).toContain('aria-label="Alex"');
  expect(markup).toContain("grid-cols-[2.75rem_minmax(0,1fr)_max-content]");
  expect(markup).toContain("h-11 w-11");
  expect(markup).toContain("lucide-undo-2");
  expect(markup).not.toContain("<button");
  expect(markup).not.toContain("chevron-right");
});

test("shows an empty read-only history state", () => {
  const markup = renderMarkup(createElement(SharedPaymentHistory, { history: [] }));

  expect(markup).toContain("No payments recorded.");
});
