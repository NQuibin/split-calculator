import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Check, Copy } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { SharedPaymentHistory } from "@/components/SharedPaymentHistory";
import { TabExpenseRow } from "@/components/TabExpenseGrid";
import { expenseListGridClass } from "@/components/tabExpenseGridClass";
import { Breadcrumb, BreadcrumbCurrent, crumbLinkClass } from "@/components/ui/Breadcrumb";
import { Button } from "@/components/ui/Button";
import { CurrencyPill } from "@/components/ui/CurrencyPill";
import { EmptyState, Page, Panel } from "@/components/ui/Page";
import { Label } from "@/components/ui/Input";
import { MemberPicker } from "@/components/ui/MemberPicker";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { Skeleton } from "@/components/ui/Skeleton";
import { GroupTitle, PageTitle } from "@/components/ui/Typography";
import { isUpcoming, todayISODate } from "@/lib/format";
import { useLocaleFormatters } from "@/lib/localeFormatters";

function SummaryAmount({
  label,
  amount,
  code,
  tone,
}: {
  label: string;
  amount: number;
  code: string;
  tone?: "owed" | "owes";
}) {
  const { currency } = useLocaleFormatters();
  return (
    <div>
      <p className="text-sm text-ink-soft">{label}</p>
      <p
        className={`font-numeric text-sm font-semibold ${tone === "owed" ? "text-ledger-green" : tone === "owes" ? "text-margin-red-ink" : "text-ink"}`}
      >
        {currency(amount, code)}
      </p>
    </div>
  );
}

export function SharedTabPage({
  slug,
  share,
  view,
  member: memberKey,
}: {
  slug: string;
  share?: string;
  member?: string;
  view: "breakdown" | "history";
}) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const navigate = useNavigate();
  const getOrCreateShareToken = useMutation(api.tabs.getOrCreateShareToken);
  const [asOfDate] = useState(todayISODate);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [shareErrorSlug, setShareErrorSlug] = useState<string | null>(null);
  const resolvingFor = useRef<string | null>(null);
  const data = useQuery(
    api.settlements.publicShare,
    share ? { slug, shareToken: share, asOfDate } : "skip",
  );

  useEffect(() => {
    if (share || isLoading || !isAuthenticated || resolvingFor.current === slug) return;
    resolvingFor.current = slug;
    void getOrCreateShareToken({ slug })
      .then((token) =>
        navigate({
          to: "/t/$slug/breakdown",
          params: { slug },
          search: { share: token, view, ...(memberKey ? { member: memberKey } : {}) },
          replace: true,
        }),
      )
      .catch(() => setShareErrorSlug(slug));
  }, [share, isLoading, isAuthenticated, slug, view, memberKey, getOrCreateShareToken, navigate]);

  if ((!share && !isLoading && !isAuthenticated) || shareErrorSlug === slug || data === null) {
    return (
      <Page width="narrow" center>
        <EmptyState status={false}>This shared tab link is unavailable.</EmptyState>
      </Page>
    );
  }

  if (!share || data === undefined) {
    return (
      <Page data-viewport-loading className="min-h-0 overflow-hidden">
        <PageTitle className="sr-only">Tab breakdown</PageTitle>
        <div role="status" className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden">
          <span className="sr-only">Loading shared tab…</span>
          <Skeleton className="h-9 w-56 shrink-0 rounded-md" />
          <Skeleton className="h-11 w-72 max-w-full shrink-0 rounded-full" />
          <Panel className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden card-inset">
            <Skeleton className="h-11 w-full shrink-0 rounded-md" />
            <div className="shrink-0 border-t border-rule pt-5">
              <Skeleton className="h-6 w-20 rounded-full" />
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[0, 1, 2, 3].map((index) => (
                  <Skeleton key={index} className="h-12 rounded-md" />
                ))}
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
                <Skeleton key={index} className="h-20 shrink-0 rounded-md" />
              ))}
            </div>
          </Panel>
        </div>
      </Page>
    );
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }

  const members = [
    ...new Map(
      data.currencies.flatMap((group) => group.members).map((member) => [member.key, member]),
    ).values(),
  ];
  const selectedMember = members.find((member) => member.key === memberKey) ?? members[0];

  return (
    <Page>
      {isAuthenticated && (
        <Breadcrumb>
          <Link to="/tabs" className={crumbLinkClass}>
            Tabs
          </Link>
          <Link to="/t/$slug" params={{ slug }} className={crumbLinkClass}>
            {data.tab.name}
          </Link>
          <BreadcrumbCurrent>Breakdown</BreadcrumbCurrent>
        </Breadcrumb>
      )}
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <PageTitle>{data.tab.name} Breakdown</PageTitle>
        </div>
        <div className="w-full sm:w-auto">
          <Button
            type="button"
            variant="secondary"
            size="touch"
            className="w-full sm:w-auto"
            onClick={() => void copyLink()}
          >
            {copied ? (
              <Check aria-hidden="true" className="size-4" />
            ) : (
              <Copy aria-hidden="true" className="size-4" />
            )}
            {copied ? "Link copied" : "Copy link"}
          </Button>
          {copyError && (
            <p role="alert" className="mt-2 text-xs text-margin-red-ink">
              Couldn’t copy the link.
            </p>
          )}
        </div>
      </header>
      <SegmentedTabs
        value={view}
        label="Shared tab pages"
        options={[
          { value: "breakdown", label: "Breakdown" },
          { value: "history", label: "Payment history" },
        ]}
        onChange={(next) => {
          void navigate({
            to: "/t/$slug/breakdown",
            params: { slug },
            search: { share, view: next, ...(memberKey ? { member: memberKey } : {}) },
          });
        }}
      >
        {view === "breakdown" ? (
          <div className="space-y-6">
            {members.length === 0 && <EmptyState>No members or expenses yet.</EmptyState>}
            {selectedMember && (
              <Panel className="space-y-5 card-inset">
                <div className="w-full pb-5">
                  <Label id="breakdown-member-label" htmlFor="breakdown-member">
                    Member
                  </Label>
                  <MemberPicker
                    id="breakdown-member"
                    labelId="breakdown-member-label"
                    value={selectedMember.key}
                    placeholder="Choose a member"
                    members={members.map(({ key, name }) => ({ id: key, name }))}
                    onChange={(member) => {
                      void navigate({
                        to: "/t/$slug/breakdown",
                        params: { slug },
                        search: { share, view, member },
                      });
                    }}
                  />
                </div>
                {data.currencies.map((group) => {
                  const member = group.members.find((entry) => entry.key === selectedMember.key);
                  const expenses = member?.expenses ?? [];
                  const remaining = (direction: "from" | "to") =>
                    group.settlements.reduce(
                      (sum, entry) =>
                        sum +
                        (entry[direction] === selectedMember.key
                          ? Math.round(entry.amount * 100)
                          : 0),
                      0,
                    ) / 100;
                  const { list } = expenseListGridClass(true, false);
                  return (
                    <section
                      key={group.currency}
                      className="space-y-3 pt-5 first-of-type:pt-0 @container"
                    >
                      <div className="flex items-center gap-2">
                        <GroupTitle as="h2">
                          <CurrencyPill code={group.currency} />
                        </GroupTitle>
                        <span className="text-xs text-ink-soft">
                          {expenses.length} {expenses.length === 1 ? "expense" : "expenses"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <SummaryAmount
                          label="Total share"
                          amount={
                            expenses.reduce(
                              (sum, expense) => sum + Math.round(expense.shareAmount * 100),
                              0,
                            ) / 100
                          }
                          code={group.currency}
                        />
                        <SummaryAmount
                          label="Total covered"
                          amount={
                            expenses.reduce(
                              (sum, expense) => sum + Math.round(expense.paidAmount * 100),
                              0,
                            ) / 100
                          }
                          code={group.currency}
                        />
                        <SummaryAmount
                          label="Still owes"
                          amount={remaining("from")}
                          code={group.currency}
                          tone="owes"
                        />
                        <SummaryAmount
                          label="Still owed"
                          amount={remaining("to")}
                          code={group.currency}
                          tone="owed"
                        />
                      </div>
                      {expenses.length === 0 ? (
                        <p className="border-y border-edge bg-field py-4 text-sm text-ink-soft bleed bleed-px">
                          No expenses for this member.
                        </p>
                      ) : (
                        <div className="overflow-hidden border-y border-edge bg-field bleed">
                          <ul className={`${list} text-sm`}>
                            {expenses.map((expense) => {
                              const payer = group.members.find((candidate) =>
                                candidate.expenses.some(
                                  (entry) => entry.key === expense.key && entry.paidAmount > 0,
                                ),
                              );
                              const covering = expense.paidAmount > 0;
                              return (
                                <TabExpenseRow
                                  key={expense.key}
                                  name={expense.name || "Untitled expense"}
                                  date={expense.date}
                                  total={expense.total}
                                  code={group.currency}
                                  payer={payer ? { id: payer.key, name: payer.name } : undefined}
                                  upcoming={isUpcoming(expense.date)}
                                  shareAmount={expense.shareAmount}
                                  memberContext={{
                                    balance:
                                      (Math.round(expense.paidAmount * 100) -
                                        Math.round(expense.shareAmount * 100)) /
                                      100,
                                    memberName: selectedMember.name,
                                    neutralPerspective: true,
                                    coversExpense: covering,
                                  }}
                                  settlementStatus={
                                    data.expenseStatuses?.find(
                                      (entry) =>
                                        entry.expenseSlug === expense.key &&
                                        entry.memberId === selectedMember.key,
                                    )?.status
                                  }
                                />
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </section>
                  );
                })}
              </Panel>
            )}
          </div>
        ) : (
          <SharedPaymentHistory history={data.history} />
        )}
      </SegmentedTabs>
    </Page>
  );
}
