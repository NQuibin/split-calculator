// @vitest-environment node
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ExpenseBalances } from "./ExpenseBalances";
import { computeSplit } from "../lib/calculations";

const people = [{ id: "nikki", name: "Nikki Q" }, { id: "p2", name: "P2" }, { id: "p3", name: "P3" }];
const zero = { mode: "percent" as const, value: 0 };
const item = { id: "dinner", name: "Dinner", cost: 120, splitWith: people.map(person => person.id), discount: zero, tax: zero, tip: zero };
const split = computeSplit(people, [item]);
const render = (props: Partial<Parameters<typeof ExpenseBalances>[0]> = {}) => renderToStaticMarkup(createElement(ExpenseBalances, { people, split, payerId: "nikki", currency: "USD", ...props }));

test("the expense form distinguishes money paid from each share and net debt", () => {
  const html = render();
  expect(html).toContain("Gets $80.00");
  expect(html.match(/Owes \$40.00/g)).toHaveLength(2);
  expect(html).toContain("Suggested transfers");
});

test("payer outside split receives the full expense back", () => {
  const html = render({ split: computeSplit(people, [{ ...item, splitWith: ["p2", "p3"] }]) });
  expect(html).toContain("Gets $120.00");
  expect(html.match(/Owes \$60.00/g)).toHaveLength(2);
});

test("missing payer and unallocated items do not show invented debts", () => {
  const missing = render({ payerId: undefined });
  expect(missing).toContain("Choose a payer");
  expect(missing).not.toContain("Gets");
  const unallocated = render({ unallocated: true });
  expect(unallocated).toContain("Choose at least one person");
  expect(unallocated).not.toContain("Suggested transfers");
});

test("upcoming expenses are clearly projected and a zero balance is settled", () => {
  expect(render({ projected: true })).toContain("Projected balance");
  const settled = render({ split: computeSplit(people, [{ ...item, splitWith: ["nikki"] }]) });
  expect(settled).toContain("Settled");
  expect(settled).toContain('text-right text-ink"><span class="inline-flex');
  expect(settled).not.toContain("Gets");

  const upcoming = render({ projected: true, split: computeSplit(people, [{ ...item, splitWith: ["nikki"] }]) });
  expect(upcoming).toContain("Not due");
  expect(upcoming).not.toContain("Settled");
});
