"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, HatGlasses } from "lucide-react";
import { currency } from "@/lib/format";
import { useTab, useTabBreakdown, type TabBreakdownMember, type TabCurrencyBreakdown } from "@/lib/tabSync";

export function TabBreakdownPageClient() {
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();
  const tab = useTab(slug);
  const breakdown = useTabBreakdown(slug);

  if (tab === undefined || breakdown === undefined) return null;
  if (tab === null || breakdown === null) {
    return (
      <main className="mx-auto w-full max-w-md px-6 py-16 text-center">
        <p className="text-ink-soft">This tab doesn&rsquo;t exist.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push(`/t/${slug}`)}
          className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-ink-soft transition hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
          {tab.name}
        </button>
        <span className="font-display text-sm font-semibold tracking-wide text-brass uppercase">Breakdown</span>
      </div>

      <h1 className="font-display mb-6 text-3xl font-semibold text-ink sm:text-4xl">
        Every expense, per person
      </h1>

      {breakdown.currencies.every((c) => c.members.length === 0) ? (
        <p className="text-sm text-ink-soft">No members yet.</p>
      ) : (
        <div className="space-y-10">
          {breakdown.currencies.map((c) => (
            <CurrencySection key={c.currency} data={c} showHeading={breakdown.currencies.length > 1} />
          ))}
        </div>
      )}
    </main>
  );
}

function CurrencySection({ data, showHeading }: { data: TabCurrencyBreakdown; showHeading: boolean }) {
  return (
    <div>
      {showHeading && (
        <p className="font-numeric mb-3 inline-flex items-center gap-1.5 rounded-full bg-brass/15 px-2.5 py-1 text-xs font-semibold text-brass">
          {data.currency}
        </p>
      )}
      <div className="space-y-6">
        {data.members.map((member) => (
          <MemberBreakdown key={member.memberId} member={member} currencyCode={data.currency} />
        ))}
      </div>
    </div>
  );
}

function MemberBreakdown({ member, currencyCode }: { member: TabBreakdownMember; currencyCode: string }) {
  const router = useRouter();

  return (
    <div className="rounded-md border border-rule bg-surface p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 font-display text-sm font-semibold tracking-wide text-ink uppercase">
          {member.name}
          {!member.claimed && (
            <HatGlasses
              className="h-3.5 w-3.5 shrink-0 text-ink-soft"
              strokeWidth={2.25}
              aria-label="Anonymous member"
            />
          )}
        </p>
        {member.netBalance > 0.005 ? (
          <span className="font-numeric shrink-0 text-sm font-semibold text-forest">
            Gets back {currency(member.netBalance, currencyCode)}
          </span>
        ) : member.netBalance < -0.005 ? (
          <span className="font-numeric shrink-0 text-sm font-semibold text-margin-red">
            Still needs to front {currency(-member.netBalance, currencyCode)}
          </span>
        ) : (
          <span className="font-numeric shrink-0 text-sm text-ink-soft">Settled up</span>
        )}
      </div>

      {member.expenses.length === 0 ? (
        <p className="text-sm text-ink-soft">Not part of any expenses yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {member.expenses.map((line) => (
            <li key={line.expenseSlug}>
              <button
                type="button"
                onClick={() => router.push(`/e/${line.expenseSlug}`)}
                className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border border-rule px-3 py-2 text-left transition hover:border-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
              >
                <span className="min-w-0">
                  <span className="block truncate text-ink">{line.expenseName}</span>
                  <span className="font-numeric block text-xs text-ink-soft">{line.date}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="font-numeric block text-ink">{currency(line.fairShare, currencyCode)}</span>
                  {line.balance > 0.005 ? (
                    <span className="font-numeric block text-xs text-forest">
                      +{currency(line.balance, currencyCode)}
                    </span>
                  ) : line.balance < -0.005 ? (
                    <span className="font-numeric block text-xs text-margin-red">
                      {currency(line.balance, currencyCode)}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex justify-between border-t border-dashed border-rule pt-3 text-xs text-ink-soft">
        <span>
          {member.expenseCount} {member.expenseCount === 1 ? "expense" : "expenses"}
        </span>
        <span>
          Spent {currency(member.totalSpent, currencyCode)} · Paid {currency(member.totalContributed, currencyCode)}
        </span>
      </div>
    </div>
  );
}
