import { Tabs } from "@base-ui/react/tabs";
import { Link, getRouteApi } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ChevronRight, HatGlasses } from "lucide-react";
import { MemberAvatar } from "@/components/MemberAvatar";
import { currency, parseISODate } from "@/lib/format";
import { useTab, useTabBreakdown, type TabBreakdownMember, type TabCurrencyBreakdown } from "@/lib/tabSync";

const route = getRouteApi("/t/$slug/breakdown");
const pageClass = "mx-auto w-full max-w-5xl flex-1 px-5 py-8 md:px-10 md:py-12";

export function TabBreakdownPage() {
  const { slug } = route.useParams();
  const tab = useTab(slug);
  const breakdown = useTabBreakdown(slug);

  if (tab === undefined || breakdown === undefined) return <main className={pageClass}><p role="status" className="text-sm text-ink-soft">Loading breakdown…</p></main>;
  if (tab === null || breakdown === null) {
    return <main className={pageClass}><p className="text-ink-soft">This tab doesn’t exist.</p></main>;
  }

  return (
    <main className={pageClass}>
      <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
        <Link to="/tabs" className="hover:text-forest hover:underline">Tabs</Link>
        <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0" />
        <Link to="/t/$slug" params={{ slug }} className="break-words hover:text-forest hover:underline">{tab.name}</Link>
        <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span aria-current="page" className="font-medium text-ink">Full breakdown</span>
      </nav>
      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Full breakdown</h1>
        <p className="mt-2 text-sm text-ink-soft">Each person’s share, payments, and balance across the tab.</p>
        {breakdown.currencies.some(c => c.convertedExpenseCount > 0) && <p className="mt-3 text-xs text-ink-soft">Includes expenses and payments converted using saved exchange rates.</p>}
      </header>
      {breakdown.currencies.every(c => c.members.length === 0) ? (
        <p className="rounded-xl border border-dashed border-rule bg-surface/60 px-6 py-10 text-center text-sm text-ink-soft">No members yet.</p>
      ) : (
        breakdown.currencies.length > 1 ? (
          <Tabs.Root>
            <Tabs.List aria-label="Breakdown currency" className="mb-6 flex gap-1 overflow-x-auto border-b border-rule">
              {breakdown.currencies.map(data => (
                <Tabs.Tab key={data.currency} value={data.currency} className="shrink-0 border-b-2 border-transparent px-4 py-3 font-display text-sm font-medium text-ink-soft transition hover:text-forest data-active:border-forest data-active:text-forest focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest">
                  {data.currency}
                </Tabs.Tab>
              ))}
            </Tabs.List>
            {breakdown.currencies.map(data => (
              <Tabs.Panel key={data.currency} value={data.currency} className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest">
                <CurrencySection data={data} />
              </Tabs.Panel>
            ))}
          </Tabs.Root>
        ) : <CurrencySection data={breakdown.currencies[0]} />
      )}
    </main>
  );
}

function CurrencySection({ data }: { data: TabCurrencyBreakdown }) {
  return (
    <section aria-label={`${data.currency} balances`}>
      <div className="space-y-5">
        {data.members.map(member => <MemberBreakdown key={member.memberId} member={member} currencyCode={data.currency} />)}
      </div>
    </section>
  );
}

function MemberBreakdown({ member, currencyCode }: { member: TabBreakdownMember; currencyCode: string }) {
  const owes = member.netBalance < -0.005;
  const receives = member.netBalance > 0.005;

  return (
    <article className="overflow-hidden rounded-xl border border-rule/70 bg-surface/80">
      <header className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <MemberAvatar id={member.memberId} name={member.name} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="break-words font-display text-lg font-semibold text-ink">{member.name}</h2>
              {!member.claimed && <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-rule px-2 py-0.5 text-xs text-ink-soft"><HatGlasses aria-hidden="true" className="h-3.5 w-3.5" />Anonymous</span>}
            </div>
            <p className="mt-1 text-xs text-ink-soft">{member.expenseCount} {member.expenseCount === 1 ? "expense" : "expenses"}</p>
          </div>
        </div>
        {owes || receives ? (
          <div className={`flex items-center gap-3 ${owes ? "text-margin-red" : "text-forest"}`}>
            <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${owes ? "bg-margin-red/10" : "bg-forest/10"}`}>
              {owes ? <ArrowUp aria-hidden="true" className="h-4 w-4" /> : <ArrowDown aria-hidden="true" className="h-4 w-4" />}
            </span>
            <span><span className="block text-xs">{owes ? "Owes" : "Receives"}</span><span className="block font-numeric text-lg font-semibold">{currency(Math.abs(member.netBalance), currencyCode)}</span></span>
          </div>
        ) : <span className="text-sm text-ink-soft">{member.expenses.length ? "Settled up" : "No expenses"}</span>}
      </header>

      {member.expenses.length === 0 ? (
        <p className="border-t border-rule/70 px-5 py-5 text-sm text-ink-soft sm:px-6">Not part of any expenses yet.</p>
      ) : (
        <ul className="divide-y divide-rule/70 border-t border-rule/70 text-sm">
          {member.expenses.map(line => (
            <li key={line.expenseSlug} className="flex flex-wrap items-start justify-between gap-x-5 gap-y-2 px-5 py-4 sm:px-6">
              <div className="min-w-0 flex-1">
                <p className="break-words font-medium text-ink">{line.expenseName || "Untitled expense"}</p>
                <time dateTime={line.date} className="mt-1 block text-xs text-ink-soft">{parseISODate(line.date)?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) ?? line.date}</time>
                <p className="mt-1 text-xs text-ink-soft">Paid <span className="font-numeric">{currency(line.contributed, currencyCode)}</span></p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-ink"><span className="text-xs text-ink-soft">Share </span><span className="font-numeric font-medium">{currency(line.fairShare, currencyCode)}</span></p>
                {Math.abs(line.balance) > 0.005 ? (
                  <p className={`mt-1 text-xs ${line.balance < 0 ? "text-margin-red" : "text-forest"}`}>{line.balance < 0 ? "Owes" : "Receives"} <span className="font-numeric">{currency(Math.abs(line.balance), currencyCode)}</span></p>
                ) : <p className="mt-1 text-xs text-ink-soft">Settled up</p>}
              </div>
            </li>
          ))}
        </ul>
      )}

      <dl className="flex flex-wrap justify-between gap-x-6 gap-y-3 border-t border-rule/70 bg-paper/50 px-5 py-4 text-sm sm:px-6">
        <div className="flex items-baseline gap-2"><dt className="text-ink-soft">Total share</dt><dd className="font-numeric font-medium text-ink">{currency(member.totalSpent, currencyCode)}</dd></div>
        <div className="flex items-baseline gap-2"><dt className="text-ink-soft">Total paid</dt><dd className="font-numeric font-medium text-ink">{currency(member.totalContributed, currencyCode)}</dd></div>
      </dl>
    </article>
  );
}
