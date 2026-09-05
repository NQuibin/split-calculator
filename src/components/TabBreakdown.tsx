"use client";

import Link from "next/link";
import { ChevronRight, HatGlasses, Wallet } from "lucide-react";
import { currency } from "@/lib/format";
import type { TabCurrencyBreakdown } from "@/lib/tabSync";

interface TabBreakdownProps {
  tabSlug: string;
  breakdown: TabCurrencyBreakdown;
  /** Show a currency code badge - only worth it once a tab actually mixes currencies. */
  showCurrencyBadge?: boolean;
}

export function TabBreakdown({ tabSlug, breakdown, showCurrencyBadge = false }: TabBreakdownProps) {
  return (
    <div className="rounded-md border border-rule bg-surface p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 font-display text-sm font-semibold tracking-wide text-ink uppercase">
          <Wallet className="h-4 w-4 text-brass" strokeWidth={2.25} />
          Tab balance across {breakdown.expenseCount} {breakdown.expenseCount === 1 ? "expense" : "expenses"}
          {showCurrencyBadge && (
            <span className="font-numeric rounded-full bg-brass/15 px-2 py-0.5 text-xs font-semibold tracking-normal text-brass normal-case">
              {breakdown.currency}
            </span>
          )}
        </p>
        {breakdown.expenseCount > 0 && (
          <Link
            href={`/t/${tabSlug}/breakdown`}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1 text-xs font-medium text-forest hover:text-ink"
          >
            Full breakdown
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
          </Link>
        )}
      </div>
      {breakdown.members.length === 0 ? (
        <p className="text-sm text-ink-soft">No members yet.</p>
      ) : (
        <>
          <ul className="space-y-3 text-sm">
            {breakdown.members.map((member) => (
              <li key={member.memberId} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-ink">
                    {member.name}
                    {!member.claimed && (
                      <HatGlasses
                        className="h-3.5 w-3.5 shrink-0 text-ink-soft"
                        strokeWidth={2.25}
                        aria-label="Anonymous member"
                      />
                    )}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {member.expenseCount} {member.expenseCount === 1 ? "expense" : "expenses"} · spent{" "}
                    {currency(member.totalSpent, breakdown.currency)}
                  </p>
                </div>
                {member.netBalance > 0.005 ? (
                  <span className="font-numeric shrink-0 font-semibold text-forest">
                    Gets back {currency(member.netBalance, breakdown.currency)}
                  </span>
                ) : member.netBalance < -0.005 ? (
                  <span className="font-numeric shrink-0 font-semibold text-margin-red">
                    Still needs to front {currency(-member.netBalance, breakdown.currency)}
                  </span>
                ) : (
                  <span className="font-numeric shrink-0 text-ink-soft">Settled up</span>
                )}
              </li>
            ))}
          </ul>
          {breakdown.members.some((m) => !m.claimed) && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-soft">
              <HatGlasses className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
              Anonymous members haven&rsquo;t signed up yet.
            </p>
          )}
        </>
      )}
    </div>
  );
}
