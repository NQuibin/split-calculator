// @vitest-environment happy-dom
import { createElement } from "react";
import { expect, test } from "vitest";
import type { TabBreakdownMember } from "@/lib/tabSync";
import { renderMarkup } from "@/test/render";
import { TabMemberBreakdown } from "./TabMemberBreakdown";

const member: TabBreakdownMember = {
  memberId: "member-1",
  resolvedId: "user-1",
  name: "Nikki Q",
  claimed: true,
  totalSpent: 6.66,
  expenseCount: 1,
  expenses: [
    {
      expenseSlug: "dinner",
      expenseName: "Dinner",
      date: "2026-09-08",
      fairShare: 6.66,
      balance: 13.34,
      payerId: "member-1",
      payerName: "Nikki Q",
      total: 20,
    },
  ],
};

test("uses the responsive expense-list layout in the member modal without totals", () => {
  const markup = renderMarkup(
    createElement(TabMemberBreakdown, {
      member,
      currencyCode: "CAD",
      variant: "modal",
      viewerMemberId: "member-1",
    }),
  );

  expect(markup).toContain(">Date<");
  expect(markup).toContain(">Expense<");
  expect(markup).toContain(">Paid by<");
  expect(markup).toContain(">Total<");
  expect(markup).toContain(">Balance<");
  expect(markup).toContain("You get");
  expect(markup).toContain("You spent");
  expect(markup).toContain("CA$6.66");
  expect(markup).toContain("Sep 08");
  expect(markup).toContain('Nikki Q <span class="text-xs text-ink-soft">paid</span>');
  expect(markup).toContain("@min-[56rem]:gap-x-6");
  expect(markup).toContain("hidden border-b border-edge bg-surface");
  expect(markup).toContain("@min-[38rem]:grid");
  expect(markup).toContain(
    "@min-[56rem]:grid-cols-[4.75rem_minmax(0,1fr)_fit-content(11rem)_fit-content(11rem)_minmax(6.75rem,max-content)]",
  );
  expect(markup).toContain("h-8 w-8");
  expect(markup).not.toContain("Total spent");
});

test("does not show spent when the selected member is not the payer", () => {
  const markup = renderMarkup(
    createElement(TabMemberBreakdown, {
      member: {
        ...member,
        memberId: "member-2",
        resolvedId: "user-2",
        name: "Pat",
        expenses: [
          {
            ...member.expenses[0],
            balance: -6.66,
            payerId: "member-1",
            payerName: "Nikki Q",
          },
        ],
      },
      currencyCode: "CAD",
      variant: "modal",
      viewerMemberId: "viewer",
    }),
  );

  expect(markup).not.toContain("spent");
  expect(markup).toContain("Pat owes");
});

test("shows selected-member settlement directions before the modal expense table", () => {
  const markup = renderMarkup(
    createElement(TabMemberBreakdown, {
      member,
      currencyCode: "CAD",
      variant: "modal",
      viewerMemberId: "viewer",
      settlements: [
        {
          fromMemberId: "member-1",
          fromName: "Nikki Q",
          toMemberId: "viewer",
          toName: "You",
          amount: 13.34,
        },
        {
          fromMemberId: "member-1",
          fromName: "Nikki Q",
          toMemberId: "member-3",
          toName: "Pat",
          amount: 2,
        },
      ],
    }),
  );

  expect(markup).toContain("Settlement breakdown");
  expect(markup).toMatch(
    /font-semibold text-ink">Nikki Q<\/span> owes <span class="font-semibold text-ink">you<\/span>/,
  );
  expect(markup).toMatch(
    /font-semibold text-ink">Nikki Q<\/span> owes <span class="font-semibold text-ink">Pat<\/span>/,
  );
  expect(markup.indexOf("Settlement breakdown")).toBeLessThan(markup.indexOf(">Date<"));
  expect(markup).toContain("CA$13.34");

  const settlementSection = markup.match(
    /<section[^>]+aria-label="Settlement breakdown"[^>]*>/,
  )?.[0];
  expect(settlementSection).toBeDefined();
  expect(settlementSection).not.toContain("bleed");
  expect(settlementSection).toContain("border-b border-rule");
  expect(settlementSection).not.toContain("pt-");
  const settlementContent = markup.match(
    /<section[^>]+aria-label="Settlement breakdown"[^>]*>[\s\S]*?<\/section>/,
  )?.[0];
  expect(settlementContent).toContain('class="mt-3 space-y-2 text-sm text-ink"');
  expect(settlementContent).toContain(
    '<h2 class="text-sm font-semibold text-ink bleed-px">Settlement breakdown</h2>',
  );
  expect(settlementContent).not.toContain("border-y");
  expect(settlementContent).not.toContain("bg-field");
  expect(markup).toContain("font-semibold text-ledger-green");
  expect(markup).toContain("font-semibold text-ink");
});

test("shows a settled state when the selected member has no suggested transfers", () => {
  const markup = renderMarkup(
    createElement(TabMemberBreakdown, {
      member,
      currencyCode: "CAD",
      variant: "modal",
      viewerMemberId: "viewer",
      settlements: [],
    }),
  );

  expect(markup).toContain("Settled up with everyone.");
  expect(markup).toContain("bleed-px mt-3 text-sm text-ink-soft");
});

test("uses viewer perspective when the viewer owes the selected member", () => {
  const markup = renderMarkup(
    createElement(TabMemberBreakdown, {
      member,
      currencyCode: "CAD",
      variant: "modal",
      viewerMemberId: "viewer",
      settlements: [
        {
          fromMemberId: "viewer",
          fromName: "Alex",
          toMemberId: "member-1",
          toName: "Nikki Q",
          amount: 13.34,
        },
      ],
    }),
  );

  expect(markup).toMatch(
    /font-semibold text-ink">You<\/span> owe <span class="font-semibold text-ink">Nikki Q<\/span>/,
  );
  expect(markup).toContain("CA$13.34");
  expect(markup).toContain("font-semibold text-margin-red-ink");
});

test("preserves the total on the standalone breakdown card", () => {
  const markup = renderMarkup(createElement(TabMemberBreakdown, { member, currencyCode: "CAD" }));

  expect(markup).toContain("Total spent");
});
