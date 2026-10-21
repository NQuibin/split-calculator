import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Check, Copy } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { ExpenseViewTabs, type ExpenseView } from "@/components/ExpenseViewTabs";
import { MemberAvatar } from "@/components/MemberAvatar";
import { SettledBalanceRow } from "@/components/SettledBalanceRow";
import { SharedPaymentHistory } from "@/components/SharedPaymentHistory";
import { TabExpenseRow } from "@/components/TabExpenseGrid";
import { expenseListGridClass } from "@/components/tabExpenseGridClass";
import { Breadcrumb, BreadcrumbCurrent, crumbLinkClass } from "@/components/ui/Breadcrumb";
import { Button } from "@/components/ui/Button";
import { CurrencyPill } from "@/components/ui/CurrencyPill";
import { EmptyState, Page, Panel } from "@/components/ui/Page";
import { Label } from "@/components/ui/Input";
import { MemberPicker } from "@/components/ui/MemberPicker";
import { Skeleton } from "@/components/ui/Skeleton";
import { GroupTitle, PageTitle } from "@/components/ui/Typography";
import { isUpcoming, todayISODate } from "@/lib/format";
import { useLocaleFormatters } from "@/lib/localeFormatters";

function SummaryAmount({
  label,
  amount,
  code,
  tone,
  prominent = false,
}: {
  label: string;
  amount: number | undefined;
  code: string;
  tone?: "owed" | "owes";
  prominent?: boolean;
}) {
  const { currency } = useLocaleFormatters();
  return (
    <div className={prominent ? "contents @min-[40rem]:block" : undefined}>
      <p
        className={`text-sm ${prominent ? "col-start-1 row-start-1 font-semibold text-ink" : "text-ink-soft"}`}
      >
        {label}
      </p>
      <p
        className={`font-numeric ${prominent ? "col-start-2 row-span-2 row-start-1 min-w-0 break-all self-center text-right text-lg @min-[40rem]:block @min-[40rem]:text-left" : "text-sm"} font-semibold ${tone === "owed" ? "text-ledger-green" : tone === "owes" ? "text-margin-red-ink" : "text-ink"}`}
      >
        {amount === undefined ? "—" : currency(amount, code)}
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
  const { currency } = useLocaleFormatters();
  const navigate = useNavigate();
  const getOrCreateShareToken = useMutation(api.tabs.getOrCreateShareToken);
  const [asOfDate] = useState(todayISODate);
  const [expenseView, setExpenseView] = useState<ExpenseView>("paid");
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
          <Skeleton className="h-11 w-72 max-w-full shrink-0 rounded-lg" />
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
  const hasUpcomingExpenses = data.currencies.some((group) =>
    group.members
      .find((member) => member.key === selectedMember?.key)
      ?.expenses.some((expense) => expense.date > asOfDate),
  );
  const activeExpenseView = hasUpcomingExpenses ? expenseView : "all";
  const currencySummaries = selectedMember
    ? data.currencies.map((group) => {
        const member = group.members.find((entry) => entry.key === selectedMember.key);
        const expenses = member?.expenses ?? [];
        const visibleExpenses = expenses
          .filter(
            (expense) =>
              activeExpenseView === "all" ||
              (activeExpenseView === "upcoming"
                ? expense.date > asOfDate
                : expense.date <= asOfDate),
          )
          .toSorted(
            (left, right) =>
              right.date.localeCompare(left.date) || (right.createdAt ?? 0) - (left.createdAt ?? 0),
          );
        const summary = member?.summaries?.[activeExpenseView];
        const fallbackBalances = () => {
          const peerCents = new Map<string, number>();
          for (const settlement of group.settlements) {
            if (settlement.from === selectedMember.key) {
              peerCents.set(
                settlement.to,
                (peerCents.get(settlement.to) ?? 0) - Math.round(settlement.amount * 100),
              );
            }
            if (settlement.to === selectedMember.key) {
              peerCents.set(
                settlement.from,
                (peerCents.get(settlement.from) ?? 0) + Math.round(settlement.amount * 100),
              );
            }
          }
          return [...peerCents].map(([memberId, cents]) => ({ memberId, balance: cents / 100 }));
        };
        const balances = !member
          ? []
          : (summary?.balances ?? (activeExpenseView === "all" ? fallbackBalances() : undefined));
        const fallbackStillOwesCents = balances?.reduce(
          (sum, entry) => sum + (entry.balance < 0 ? Math.round(-entry.balance * 100) : 0),
          0,
        );
        const fallbackStillOwedCents = balances?.reduce(
          (sum, entry) => sum + (entry.balance > 0 ? Math.round(entry.balance * 100) : 0),
          0,
        );
        const fallbackStillOwes =
          fallbackStillOwesCents === undefined ? undefined : fallbackStillOwesCents / 100;
        const fallbackStillOwed =
          fallbackStillOwedCents === undefined ? undefined : fallbackStillOwedCents / 100;
        const totalShare = !member
          ? 0
          : (summary?.totalShare ??
            visibleExpenses.reduce(
              (sum, expense) => sum + Math.round(expense.shareAmount * 100),
              0,
            ) / 100);
        const totalCovered = !member
          ? 0
          : (summary?.totalCovered ??
            visibleExpenses.reduce(
              (sum, expense) => sum + Math.round(expense.paidAmount * 100),
              0,
            ) / 100);
        const stillOwes = !member ? 0 : (summary?.stillOwes ?? fallbackStillOwes);
        const stillOwed = !member ? 0 : (summary?.stillOwed ?? fallbackStillOwed);
        return {
          group,
          expenses,
          visibleExpenses,
          balances,
          totalShare,
          totalCovered,
          stillOwes,
          stillOwed,
        };
      })
    : [];
  const visibleCurrencySummaries = currencySummaries.filter(
    ({ visibleExpenses, balances, stillOwes, stillOwed }) =>
      visibleExpenses.length > 0 ||
      balances === undefined ||
      (stillOwes ?? 0) > 0 ||
      (stillOwed ?? 0) > 0 ||
      balances.some((entry) => entry.balance !== 0),
  );
  const currencySections = selectedMember
    ? visibleCurrencySummaries.map(
        (
          {
            group,
            expenses,
            visibleExpenses,
            balances,
            totalShare,
            totalCovered,
            stillOwes,
            stillOwed,
          },
          index,
        ) => {
          const { list } = expenseListGridClass(true, false);
          const outstandingMembers = (balances ?? []).filter(
            (entry) => Math.round(entry.balance * 100) !== 0,
          );
          const owingMembers = outstandingMembers
            .filter((entry) => entry.balance > 0)
            .toSorted((a, b) => b.balance - a.balance);
          const owedMembers = outstandingMembers
            .filter((entry) => entry.balance < 0)
            .toSorted((a, b) => a.balance - b.balance);
          const hasOutstanding = (stillOwed ?? 0) > 0 || (stillOwes ?? 0) > 0;
          const isSettled =
            balances !== undefined && outstandingMembers.length === 0 && !hasOutstanding;
          const showSummary = hasOutstanding || outstandingMembers.length > 0;
          const summaryRail = showSummary && (
            <div className="grid min-w-0 grid-cols-1 gap-3 border-b-2 border-rule px-4 py-3 @min-[40rem]:border-b-0 @min-[40rem]:flex @min-[40rem]:flex-col @min-[40rem]:gap-6 @min-[40rem]:p-6">
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] grid-rows-2 items-center gap-x-3 @min-[40rem]:block">
                <SummaryAmount
                  label="Still owed"
                  amount={stillOwed ?? 0}
                  code={group.currency}
                  tone="owed"
                  prominent
                />
                {balances !== undefined && (
                  <p className="col-start-1 row-start-2 mt-0 text-xs text-ink-soft @min-[40rem]:mt-1">
                    From {owingMembers.length} {owingMembers.length === 1 ? "person" : "people"}
                  </p>
                )}
              </div>
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] grid-rows-2 items-center gap-x-3 @min-[40rem]:block">
                <SummaryAmount
                  label="Still owes"
                  amount={stillOwes ?? 0}
                  code={group.currency}
                  tone="owes"
                  prominent
                />
                {balances !== undefined && (
                  <p className="col-start-1 row-start-2 mt-0 text-xs text-ink-soft @min-[40rem]:mt-1">
                    To {owedMembers.length} {owedMembers.length === 1 ? "person" : "people"}
                  </p>
                )}
              </div>
            </div>
          );
          return (
            <section
              key={group.currency}
              aria-label={`${group.currency} breakdown`}
              className="space-y-3 pt-5 first-of-type:pt-0 @container"
            >
              <section
                aria-label={`${group.currency} balances for ${selectedMember.name}`}
                className="space-y-0 bleed"
              >
                {isSettled ? (
                  <>
                    <GroupTitle as="h2" className="sr-only">
                      Balances for {selectedMember.name}
                    </GroupTitle>
                    <SettledBalanceRow currencyCode={group.currency} />
                  </>
                ) : (
                  <header className="flex min-w-0 items-center justify-end gap-3 bleed-px pb-3">
                    <GroupTitle as="h2" className="sr-only">
                      Balances for {selectedMember.name}
                    </GroupTitle>
                    <CurrencyPill code={group.currency} />
                  </header>
                )}
                {balances === undefined ? (
                  <div className="grid grid-cols-1 border-y border-edge bg-field @min-[40rem]:grid-cols-[13.5rem_minmax(0,1fr)]">
                    {summaryRail}
                    <p
                      className={`py-4 text-sm text-ink-soft bleed-px ${showSummary ? "@min-[40rem]:border-l-2 @min-[40rem]:border-rule" : "@min-[40rem]:col-span-full"}`}
                    >
                      Member balances are unavailable for this view.
                    </p>
                  </div>
                ) : outstandingMembers.length === 0 ? (
                  hasOutstanding ? (
                    <div className="grid grid-cols-1 border-y border-edge bg-field @min-[40rem]:grid-cols-[13.5rem_minmax(0,1fr)]">
                      {summaryRail}
                    </div>
                  ) : null
                ) : (
                  <div className="grid grid-cols-1 border-y border-edge bg-field @min-[40rem]:grid-cols-[13.5rem_minmax(0,1fr)]">
                    {summaryRail}
                    <ul className="divide-y divide-rule @min-[40rem]:border-l-2 @min-[40rem]:border-rule">
                      {owingMembers.map((entry, index) => {
                        const peerName =
                          members.find((candidate) => candidate.key === entry.memberId)?.name ??
                          "Member";
                        return (
                          <li
                            key={entry.memberId}
                            aria-label={`${peerName} owes ${selectedMember.name} ${currency(Math.abs(entry.balance), group.currency)}`}
                          >
                            {index === 0 && (
                              <GroupTitle as="h3" className="px-5 pt-3 text-ink">
                                Owe {selectedMember.name}
                              </GroupTitle>
                            )}
                            <div className="flex min-h-16 min-w-0 items-center gap-3 py-3 bleed-px">
                              <MemberAvatar id={entry.memberId} name={peerName} size="md" />
                              <span className="min-w-0 break-words text-sm font-medium text-ink">
                                {peerName}
                              </span>
                              <span className="ml-auto font-numeric text-sm font-semibold text-ledger-green">
                                {currency(Math.abs(entry.balance), group.currency)}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                      {owedMembers.map((entry, index) => {
                        const peerName =
                          members.find((candidate) => candidate.key === entry.memberId)?.name ??
                          "Member";
                        return (
                          <li
                            key={entry.memberId}
                            aria-label={`${selectedMember.name} owes ${peerName} ${currency(Math.abs(entry.balance), group.currency)}`}
                          >
                            {index === 0 && (
                              <GroupTitle as="h3" className="px-5 pt-3 text-ink">
                                {selectedMember.name} owes
                              </GroupTitle>
                            )}
                            <div className="flex min-h-16 min-w-0 items-center gap-3 py-3 bleed-px">
                              <MemberAvatar id={entry.memberId} name={peerName} size="md" />
                              <span className="min-w-0 break-words text-sm font-medium text-ink">
                                {peerName}
                              </span>
                              <span className="ml-auto font-numeric text-sm font-semibold text-margin-red-ink">
                                {currency(Math.abs(entry.balance), group.currency)}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </section>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <GroupTitle as="h3" className="mr-auto flex items-center gap-2 text-lg">
                  Expenses{" "}
                  <span className="text-sm font-normal text-ink-soft">
                    {visibleExpenses.length}
                  </span>
                </GroupTitle>
                <div className="text-right">
                  <SummaryAmount
                    label="Total"
                    amount={
                      visibleExpenses.reduce(
                        (sum, expense) => sum + Math.round(expense.total * 100),
                        0,
                      ) / 100
                    }
                    code={group.currency}
                  />
                </div>
              </div>
              {expenses.length === 0 ? (
                <p className="border-y border-edge bg-field py-4 text-sm text-ink-soft bleed bleed-px">
                  No expenses for this member.
                </p>
              ) : visibleExpenses.length === 0 ? (
                <p className="border-y border-edge bg-field py-4 text-sm text-ink-soft bleed bleed-px">
                  No {activeExpenseView === "upcoming" ? "upcoming" : "paid"} expenses for this
                  member.
                </p>
              ) : (
                <div className="overflow-hidden border-y border-edge bg-field bleed">
                  <ul
                    aria-label={`${group.currency} expenses for ${selectedMember.name}`}
                    className={`${list} text-sm`}
                  >
                    {visibleExpenses.map((expense) => {
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
              <div
                className={`flex flex-wrap justify-end gap-x-6 gap-y-3 text-right ${index < visibleCurrencySummaries.length - 1 ? "border-b border-rule bleed bleed-px pb-5" : ""}`}
              >
                <SummaryAmount label="Total share" amount={totalShare} code={group.currency} />
                <SummaryAmount label="Total covered" amount={totalCovered} code={group.currency} />
              </div>
            </section>
          );
        },
      )
    : null;

  const breakdownCard = (
    <Panel className="space-y-5 card-inset">
      <div className="w-full pb-5">
        <Label id="breakdown-member-label" htmlFor="breakdown-member">
          Member
        </Label>
        <MemberPicker
          id="breakdown-member"
          labelId="breakdown-member-label"
          value={selectedMember?.key}
          placeholder="Choose a member"
          members={members.map(({ key, name }) => ({ id: key, name }))}
          onChange={(member) => {
            void navigate({
              to: "/t/$slug/breakdown",
              params: { slug },
              search: { share, member },
            });
          }}
        />
      </div>
      {currencySections}
      {selectedMember && visibleCurrencySummaries.length === 0 && (
        <p className="text-sm text-ink-soft">
          No expenses or outstanding balances for this member.
        </p>
      )}
    </Panel>
  );

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
        <div className="flex w-full min-w-0 items-start gap-2 overflow-x-auto py-1 sm:w-auto sm:gap-3">
          <div className="min-w-max flex-1 sm:flex-none">
            <Button
              type="button"
              variant="secondary"
              size="touch"
              className="w-full px-3 sm:px-5"
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
          <SharedPaymentHistory history={data.history} defaultOpen={view === "history"} />
        </div>
      </header>
      <div className="space-y-6">
        {members.length === 0 && <EmptyState>No members or expenses yet.</EmptyState>}
        {selectedMember &&
          (hasUpcomingExpenses ? (
            <ExpenseViewTabs value={expenseView} onChange={setExpenseView} label="Expense date">
              {breakdownCard}
            </ExpenseViewTabs>
          ) : (
            breakdownCard
          ))}
      </div>
    </Page>
  );
}
