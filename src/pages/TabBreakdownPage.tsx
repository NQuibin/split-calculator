import { Tabs } from "@base-ui/react/tabs";
import { Link, getRouteApi } from "@tanstack/react-router";
import { MemberAvatar } from "@/components/MemberAvatar";
import { currency, parseISODate } from "@/lib/format";
import { useTab, useTabBreakdown, type TabBreakdownMember, type TabCurrencyBreakdown } from "@/lib/tabSync";
import { PageDescription, PageTitle, SectionTitle } from "@/components/ui/Typography";
import { EmptyState, Page } from "@/components/ui/Page";
import { Breadcrumb, BreadcrumbCurrent, crumbLinkClass } from "@/components/ui/Breadcrumb";

const route = getRouteApi("/t/$slug/breakdown");
export function TabBreakdownPage() {
  const { slug } = route.useParams();
  const tab = useTab(slug);
  const breakdown = useTabBreakdown(slug);

  if (tab === undefined || breakdown === undefined) return <Page><p role="status" className="text-sm text-ink-soft">Loading breakdown…</p></Page>;
  if (tab === null || breakdown === null) {
    return <Page><p className="text-ink-soft">This tab doesn’t exist.</p></Page>;
  }

  return (
    <Page>
      <Breadcrumb>
        <Link to="/tabs" className={crumbLinkClass}>Tabs</Link>
        <Link to="/t/$slug" params={{ slug }} className={crumbLinkClass}>{tab.name}</Link>
        <BreadcrumbCurrent>Full breakdown</BreadcrumbCurrent>
      </Breadcrumb>
      <header className="mb-8">
        <PageTitle>Full breakdown</PageTitle>
        <PageDescription>Each person’s share of every expense across the tab.</PageDescription>
        {breakdown.currencies.some(c => c.convertedExpenseCount > 0) && <p className="mt-3 text-xs text-ink-soft">Includes expenses converted using saved exchange rates.</p>}
      </header>
      {breakdown.currencies.every(c => c.members.length === 0) ? (
        <EmptyState>No members yet.</EmptyState>
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
    </Page>
  );
}

function CurrencySection({ data }: { data: TabCurrencyBreakdown }) {
  return (
    <section aria-label={`${data.currency} spend`}>
      <div className="space-y-5">
        {data.members.map(member => <MemberBreakdown key={member.memberId} member={member} currencyCode={data.currency} />)}
      </div>
    </section>
  );
}

function MemberBreakdown({ member, currencyCode }: { member: TabBreakdownMember; currencyCode: string }) {
  return (
    <article className="overflow-hidden rounded-xl border border-rule/70 bg-surface/80">
      <header className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <MemberAvatar id={member.memberId} name={member.name} size="lg" />
          <div className="min-w-0">
            <SectionTitle>{member.name}</SectionTitle>
            <p className="mt-1 text-xs text-ink-soft">{member.expenseCount} {member.expenseCount === 1 ? "expense" : "expenses"}</p>
          </div>
        </div>
        {member.expenses.length ? (
          <span><span className="block text-xs text-ink-soft">Total spent</span><span className="block font-numeric text-lg font-semibold text-ink">{currency(member.totalSpent, currencyCode)}</span></span>
        ) : <span className="text-sm text-ink-soft">No expenses</span>}
      </header>

      {member.expenses.length === 0 ? (
        <p className="border-t border-rule/70 bg-field px-5 py-5 text-sm text-ink-soft sm:px-6">Not part of any expenses yet.</p>
      ) : (
        <ul className="divide-y divide-rule/70 border-t border-rule/70 bg-field text-sm">
          {member.expenses.map(line => (
            <li key={line.expenseSlug} className="flex flex-wrap items-start justify-between gap-x-5 gap-y-2 px-5 py-4 sm:px-6">
              <div className="min-w-0 flex-1">
                <p className="break-words font-medium text-ink">{line.expenseName || "Untitled expense"}</p>
                <time dateTime={line.date} className="mt-1 block text-xs text-ink-soft">{parseISODate(line.date)?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) ?? line.date}</time>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-ink"><span className="text-xs text-ink-soft">Share </span><span className="font-numeric font-medium">{currency(line.fairShare, currencyCode)}</span></p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <dl className="flex flex-wrap justify-between gap-x-6 gap-y-3 border-t border-rule/70 bg-band px-5 py-4 text-sm sm:px-6">
        <div className="flex items-baseline gap-2"><dt className="text-ink-soft">Total spent</dt><dd className="font-numeric font-medium text-ink">{currency(member.totalSpent, currencyCode)}</dd></div>
      </dl>
    </article>
  );
}
