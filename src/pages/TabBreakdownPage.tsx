import { Tabs } from "@base-ui/react/tabs";
import { Link, getRouteApi } from "@tanstack/react-router";
import { useTab, useTabBreakdown, type TabCurrencyBreakdown } from "@/lib/tabSync";
import { PageDescription, PageTitle } from "@/components/ui/Typography";
import { EmptyState, Page } from "@/components/ui/Page";
import { Breadcrumb, BreadcrumbCurrent, crumbLinkClass } from "@/components/ui/Breadcrumb";
import { TabMemberBreakdown } from "@/components/TabMemberBreakdown";

const route = getRouteApi("/t/$slug/breakdown");
export function TabBreakdownPage() {
  const { slug } = route.useParams();
  const tab = useTab(slug);
  const breakdown = useTabBreakdown(slug);

  if (tab === undefined || breakdown === undefined)
    return (
      <Page>
        <p role="status" className="text-sm text-ink-soft">
          Loading breakdown…
        </p>
      </Page>
    );
  if (tab === null || breakdown === null) {
    return (
      <Page>
        <p className="text-ink-soft">This tab doesn’t exist.</p>
      </Page>
    );
  }

  return (
    <Page>
      <Breadcrumb>
        <Link to="/tabs" className={crumbLinkClass}>
          Tabs
        </Link>
        <Link to="/t/$slug" params={{ slug }} className={crumbLinkClass}>
          {tab.name}
        </Link>
        <BreadcrumbCurrent>Breakdown</BreadcrumbCurrent>
      </Breadcrumb>
      <header className="mb-8">
        <PageTitle>Breakdown</PageTitle>
        <PageDescription>Each person’s share of every expense across the tab.</PageDescription>
        {breakdown.currencies.some((c) => c.convertedExpenseCount > 0) && (
          <p className="mt-3 text-xs text-ink-soft">
            Includes expenses converted using saved exchange rates.
          </p>
        )}
      </header>
      {breakdown.currencies.every((c) => c.members.length === 0) ? (
        <EmptyState>No members yet.</EmptyState>
      ) : breakdown.currencies.length > 1 ? (
        <Tabs.Root>
          <Tabs.List
            aria-label="Breakdown currency"
            className="mb-6 flex gap-1 overflow-x-auto border-b border-rule"
          >
            {breakdown.currencies.map((data) => (
              <Tabs.Tab
                key={data.currency}
                value={data.currency}
                className="shrink-0 border-b-2 border-transparent px-4 py-3 font-display text-sm font-medium text-ink-soft transition hover:text-forest data-active:border-forest data-active:text-forest focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest"
              >
                {data.currency}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {breakdown.currencies.map((data) => (
            <Tabs.Panel
              key={data.currency}
              value={data.currency}
              className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest"
            >
              <CurrencySection data={data} />
            </Tabs.Panel>
          ))}
        </Tabs.Root>
      ) : (
        <CurrencySection data={breakdown.currencies[0]} />
      )}
    </Page>
  );
}

function CurrencySection({ data }: { data: TabCurrencyBreakdown }) {
  return (
    <section aria-label={`${data.currency} spend`}>
      <div className="space-y-5">
        {data.members.map((member) => (
          <TabMemberBreakdown key={member.memberId} member={member} currencyCode={data.currency} />
        ))}
      </div>
    </section>
  );
}
