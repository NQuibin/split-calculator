import type { ExpenseView } from "@/components/ExpenseViewTabs";
import { filterSpendSummary } from "@/lib/filterSpendSummary";
import type { TabExpenseSummary } from "@/lib/tabSync";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Scale } from "lucide-react";
import { MemberAvatar } from "@/components/MemberAvatar";
import { CURRENCIES } from "@/lib/currencies";
import { currency } from "@/lib/format";
import type { TabCurrencyBreakdown, TabMemberSummary } from "@/lib/tabSync";
import { GroupTitle, SectionTitle } from "@/components/ui/Typography";
import { mobileRaisedSurfaceClass } from "@/components/ui/mobileRaisedSurface";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

interface TabBreakdownProps {
  expenseView: ExpenseView;
  hasUpcoming: boolean;
  expenses: TabExpenseSummary[];
  tabSlug: string;
  currencies: TabCurrencyBreakdown[];
  members: TabMemberSummary[];
}

function SpendSummaryList({
  currencies,
  members,
  viewerMemberId,
}: {
  currencies: TabCurrencyBreakdown[];
  members: TabMemberSummary[];
  viewerMemberId: string | undefined;
}) {
  return (
    <div className="space-y-5">
      {currencies.map((group) => {
        const currencyName = CURRENCIES.find((option) => option.code === group.currency)?.name;
        const totalSpent = group.members.reduce((sum, member) => sum + member.totalSpent, 0);

        return (
          <section key={group.currency} aria-label={`${group.currency} spending`}>
            <GroupTitle
              as="h3"
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 bg-band px-3 py-2"
            >
              <span>
                <span className="font-numeric">{group.currency}</span>
                {currencyName && (
                  <span className="font-normal text-ink-soft"> · {currencyName}</span>
                )}
              </span>
              <span className="font-numeric text-xs font-medium text-ink-soft">
                Total {currency(totalSpent, group.currency)}
              </span>
            </GroupTitle>
            <ul className="divide-y divide-rule">
              {members.map((member) => {
                const entry = group.members.find((row) => row.memberId === member.id);
                const isViewer = member.id === viewerMemberId;
                return (
                  <li
                    key={member.id}
                    className="flex min-w-0 items-center justify-between gap-3 py-3"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <MemberAvatar id={member.id} name={member.name} size="sm" />
                      <span className="min-w-0 break-words font-medium">
                        {member.name}
                        {isViewer && <span className="text-ink-soft"> (you)</span>}
                      </span>
                    </span>
                    {entry && entry.expenseCount > 0 ? (
                      <span className="font-numeric font-semibold text-ink">
                        {currency(entry.totalSpent, group.currency)}
                      </span>
                    ) : (
                      <span className="text-xs text-ink-soft">No expenses</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function TabBreakdown({
  tabSlug,
  currencies: allCurrencies,
  members,
  expenseView,
  hasUpcoming,
  expenses,
}: TabBreakdownProps) {
  const viewer = useQuery(api.users.viewer);
  const currencies = filterSpendSummary(allCurrencies, expenses, hasUpcoming ? expenseView : "all");
  const viewerMemberId = members.find((member) => member.resolvedId === viewer?._id)?.id;
  const orderedMembers = [...members].sort(
    (a, b) => Number(b.id === viewerMemberId) - Number(a.id === viewerMemberId),
  );

  const summary = (
    <>
      {currencies.some((item) => item.convertedExpenseCount > 0) && (
        <p className="mb-4 text-xs text-ink-soft">
          Includes expenses converted using saved exchange rates.
        </p>
      )}
      {!members.length ? (
        <p className="text-sm text-ink-soft">No members yet.</p>
      ) : !currencies.length ? (
        <p className="text-sm text-ink-soft">No expenses yet.</p>
      ) : (
        <SpendSummaryList
          currencies={currencies}
          members={orderedMembers}
          viewerMemberId={viewerMemberId}
        />
      )}
    </>
  );

  return (
    <section
      aria-label="Spend summary"
      className={`${mobileRaisedSurfaceClass} border border-rule/70 bg-surface/80 p-5 sm:p-6`}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SectionTitle className="flex items-center gap-2">
          <Scale aria-hidden="true" className="h-5 w-5 text-brass" strokeWidth={2.25} />
          Spend summary
        </SectionTitle>
        {currencies.some((item) => item.expenseCount > 0) && (
          <Link
            to="/t/$slug/breakdown"
            params={{ slug: tabSlug }}
            className="group ml-auto inline-flex min-h-11 items-center gap-1 rounded-md text-xs font-medium text-forest hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            Breakdown <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 chevron-x" />
          </Link>
        )}
      </div>
      {summary}
    </section>
  );
}
