import type { ExpenseView } from "@/components/ExpenseViewTabs";
import { filterSpendSummary } from "@/lib/filterSpendSummary";
import type { TabExpenseSummary } from "@/lib/tabSync";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Scale } from "lucide-react";
import { CurrencyFilter } from "@/components/ui/CurrencyFilter";
import { MemberAvatar } from "@/components/MemberAvatar";
import { currency } from "@/lib/format";
import type { TabCurrencyBreakdown, TabMemberSummary } from "@/lib/tabSync";
import { SectionTitle } from "@/components/ui/Typography";
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
  const [selectedCurrency, setSelectedCurrency] = useState("all");
  const activeCurrency = currencies.some((item) => item.currency === selectedCurrency)
    ? selectedCurrency
    : "all";
  const visibleCurrencies = currencies.filter(
    (item) => activeCurrency === "all" || item.currency === activeCurrency,
  );
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
        <div className="overflow-x-auto rounded-lg border border-edge bg-field">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-rule/70 bg-band">
                <th
                  scope="col"
                  className="min-w-40 px-4 py-3 text-xs font-medium uppercase text-ink-soft"
                >
                  Member
                </th>
                {visibleCurrencies.map((item) => (
                  <th scope="col" key={item.currency} className="min-w-44 px-5 py-3 font-medium">
                    {item.currency}
                    <span className="mt-0.5 block text-xs font-normal text-ink-soft">
                      Total spent:{" "}
                      {currency(
                        item.members.reduce((sum, member) => sum + member.totalSpent, 0),
                        item.currency,
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orderedMembers.map((member) => (
                <tr key={member.id} className="border-b border-rule/70 last:border-b-0">
                  <th scope="row" className="px-4 py-3 font-medium">
                    <span className="flex items-center gap-3">
                      <MemberAvatar id={member.id} name={member.name} />
                      <span className="break-words">
                        {member.name}
                        {member.id === viewerMemberId && (
                          <span className="text-ink-soft"> (you)</span>
                        )}
                      </span>
                    </span>
                  </th>
                  {visibleCurrencies.map((item) => {
                    const entry = item.members.find((row) => row.memberId === member.id);
                    return (
                      <td key={item.currency} className="px-5 py-3">
                        {entry && entry.expenseCount > 0 ? (
                          <span className="font-numeric font-semibold text-ink">
                            {currency(entry.totalSpent, item.currency)}
                          </span>
                        ) : (
                          <span className="text-xs text-ink-soft">No expenses</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  return (
    <section
      aria-label="Spend summary"
      className="rounded-xl border border-rule/70 bg-surface/80 p-5 sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SectionTitle className="flex items-center gap-2">
          <Scale aria-hidden="true" className="h-5 w-5 text-brass" strokeWidth={2.25} />
          Spend summary
        </SectionTitle>
        <div className="flex flex-wrap items-center gap-4">
          {currencies.some((item) => item.expenseCount > 0) && (
            <Link
              to="/t/$slug/breakdown"
              params={{ slug: tabSlug }}
              className="group inline-flex min-h-11 items-center gap-1 rounded-md text-xs font-medium text-forest hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            >
              Full breakdown <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 chevron-x" />
            </Link>
          )}
          {currencies.length > 1 && (
            <CurrencyFilter
              value={activeCurrency}
              onChange={setSelectedCurrency}
              codes={currencies.map((item) => item.currency)}
              label="Spend summary currency"
            />
          )}
        </div>
      </div>
      {summary}
    </section>
  );
}
