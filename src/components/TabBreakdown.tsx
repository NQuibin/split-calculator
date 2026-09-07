import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ChevronRight, HatGlasses, Scale } from "lucide-react";
import { CurrencyFilter } from "@/components/ui/CurrencyFilter";
import { MemberAvatar } from "@/components/MemberAvatar";
import { currency } from "@/lib/format";
import type { TabCurrencyBreakdown, TabMemberSummary } from "@/lib/tabSync";

interface TabBreakdownProps {
  tabSlug: string;
  currencies: TabCurrencyBreakdown[];
  members: TabMemberSummary[];
}

export function TabBreakdown({ tabSlug, currencies, members }: TabBreakdownProps) {
  const [selectedCurrency, setSelectedCurrency] = useState("all");
  const activeCurrency = currencies.some(item => item.currency === selectedCurrency) ? selectedCurrency : "all";
  const visibleCurrencies = currencies.filter(item => activeCurrency === "all" || item.currency === activeCurrency);

  return (
    <section aria-label="Balance summary" className="rounded-xl border border-rule/70 bg-surface/80 p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-ink">
          <Scale aria-hidden="true" className="h-5 w-5 text-brass" strokeWidth={2.25} />
          Balance summary
        </h2>
        <div className="flex flex-wrap items-center gap-4">
          {currencies.some(item => item.expenseCount > 0) && (
            <Link to="/t/$slug/breakdown" params={{ slug: tabSlug }} className="inline-flex items-center gap-1 text-xs font-medium text-forest hover:text-ink">
              Full breakdown <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          )}
          {currencies.length > 1 && (
            <CurrencyFilter value={activeCurrency} onChange={setSelectedCurrency} codes={currencies.map(item => item.currency)} label="Balance summary currency" />
          )}
        </div>
      </div>
      {currencies.some(item => item.convertedExpenseCount > 0) && <p className="mb-4 text-xs text-ink-soft">Includes expenses converted using saved exchange rates.</p>}
      {!members.length ? <p className="text-sm text-ink-soft">No members yet.</p> : !currencies.length ? <p className="text-sm text-ink-soft">No expenses yet.</p> : (
        <div className="overflow-x-auto rounded-lg border border-rule/70">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-rule/70">
                <th scope="col" className="min-w-40 px-4 py-3 text-xs font-medium uppercase text-ink-soft">Member</th>
                {visibleCurrencies.map(item => (
                  <th scope="col" key={item.currency} className="min-w-44 border-l border-rule/70 px-5 py-3 font-medium">
                    {item.currency}
                    <span className="mt-0.5 block text-xs font-normal text-ink-soft">Total spent: {currency(item.members.reduce((sum, member) => sum + member.totalSpent, 0), item.currency)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map(member => (
                <tr key={member.id} className="border-b border-rule/70 last:border-b-0">
                  <th scope="row" className="px-4 py-3 font-medium">
                    <span className="flex items-center gap-3">
                      <MemberAvatar id={member.id} name={member.name} />
                      <span className="break-words">{member.name}</span>
                      {!member.claimed && <HatGlasses className="h-3.5 w-3.5 shrink-0 text-ink-soft" aria-label="Anonymous member" />}
                    </span>
                  </th>
                  {visibleCurrencies.map(item => {
                    const balance = item.members.find(entry => entry.memberId === member.id);
                    const net = balance?.netBalance ?? 0;
                    const owes = net < -0.005;
                    const receives = net > 0.005;
                    return (
                      <td key={item.currency} className="border-l border-rule/70 px-5 py-3">
                        {owes || receives ? (
                          <div className={`flex items-center gap-3 ${owes ? "text-margin-red" : "text-forest"}`}>
                            <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${owes ? "bg-margin-red/10" : "bg-forest/10"}`}>
                              {owes ? <ArrowUp aria-hidden="true" className="h-4 w-4" /> : <ArrowDown aria-hidden="true" className="h-4 w-4" />}
                            </span>
                            <span><span className="block text-xs">{owes ? "Owes" : "Receives"}</span><span className="block font-numeric font-semibold">{currency(Math.abs(net), item.currency)}</span></span>
                          </div>
                        ) : <span className="text-xs text-ink-soft">{balance ? "Settled up" : "No expenses"}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
