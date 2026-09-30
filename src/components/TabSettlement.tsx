import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Banknote, ChevronRight, History, X } from "lucide-react";

import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/Dialog";
import { MemberAvatar } from "@/components/MemberAvatar";
import { TabMemberBreakdown } from "@/components/TabMemberBreakdown";
import { ExpenseDetailsDialog } from "@/components/ExpenseDetailsDialog";
import { Panel } from "@/components/ui/Page";
import { todayISODate } from "@/lib/format";
import { computeSplit } from "@/lib/calculations";
import { useLocaleFormatters } from "@/lib/localeFormatters";
import { useTabBreakdown, type TabExpenseSummary } from "@/lib/tabSync";
import type { ExpenseView } from "@/components/ExpenseViewTabs";

type Member = { id: string; name: string };
type SettlementResponse = NonNullable<FunctionReturnType<typeof api.settlements.get>>;
type SettlementQueryResponse = SettlementResponse | SettlementResponse["paid"];
export type SettlementSummaryData = {
  viewerMemberId: string | null;
  missingPayers: { slug: string; name: string }[];
  history: {
    id: string;
    fromMemberId: string;
    toMemberId: string;
    amount: number;
    currency: string;
    date: string;
    reversed: boolean;
    view?: ExpenseView;
  }[];
  currencies: {
    currency: string;
    members: {
      memberId: string;
      name: string;
      balance: number;
      /** Positive means this member owes the viewer; negative means the viewer owes them. */
      balanceWithViewer?: number;
      includedIn?: number;
      expenses: {
        expenseId: string;
        expenseSlug: string;
        name: string;
        date: string;
        outstanding: number;
      }[];
    }[];
  }[];
};

function memberDirectBalance(
  member: SettlementSummaryData["currencies"][number]["members"][number],
) {
  return member.balanceWithViewer ?? member.balance;
}

function relatedExpenseCount(
  expenses: TabExpenseSummary[],
  view: ExpenseView,
  asOfDate: string,
  currency: string,
  viewerMemberId: string,
  memberId: string,
) {
  return expenses.filter((expense) => {
    if (expense.settlementCurrency !== currency) return false;
    if (view === "paid" && expense.date > asOfDate) return false;
    if (view === "upcoming" && expense.date <= asOfDate) return false;
    const shares = computeSplit(expense.people, expense.items, expense.globalAdjustments).people;
    const hasShare = (id: string) =>
      Math.round((shares.find((person) => person.personId === id)?.total ?? 0) * 100) !== 0;
    return (
      (expense.payerId === viewerMemberId && hasShare(memberId)) ||
      (expense.payerId === memberId && hasShare(viewerMemberId))
    );
  }).length;
}

export function SettlementSummary({
  data,
  viewerName,
  expenses = [],
  expenseView = "all",
  asOfDate = todayISODate(),
  canManage = false,
  onMemberClick,
}: {
  data: SettlementSummaryData;
  viewerName?: string;
  expenses?: TabExpenseSummary[];
  expenseView?: ExpenseView;
  asOfDate?: string;
  canManage?: boolean;
  onMemberClick?: (memberId: string, currencyCode: string) => void;
}) {
  const { currency } = useLocaleFormatters();
  const viewer = data.currencies
    .flatMap((group) => group.members)
    .find((member) => member.memberId === data.viewerMemberId);

  return (
    <div className="text-sm" aria-live="polite">
      {data.missingPayers.length > 0 && (
        <div className="mb-3">
          <p className="text-margin-red-ink">
            Balances incomplete: payer needed for {data.missingPayers.length}{" "}
            {data.missingPayers.length === 1 ? "expense" : "expenses"}.
          </p>
          <ul className="mt-2">
            {data.missingPayers.map((expense) => (
              <li key={expense.slug} className="break-words">
                {canManage ? (
                  <Button
                    variant="link"
                    size="touch"
                    nativeButton={false}
                    className="h-auto whitespace-normal px-0 text-left"
                    render={<Link to="/e/$slug" params={{ slug: expense.slug }} />}
                  >
                    {expense.name || "Untitled expense"}
                  </Button>
                ) : (
                  expense.name || "Untitled expense"
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!data.viewerMemberId ? (
        <p className="text-ink-soft">View balances</p>
      ) : (
        <>
          <div className="flex min-w-0 items-center border-b border-rule bleed bleed-px pb-4">
            <div className="flex min-w-0 items-center gap-3">
              <MemberAvatar
                id={data.viewerMemberId}
                name={viewer?.name ?? viewerName ?? "You"}
                size="md"
              />
              <div className="min-w-0 break-words">
                <p className="font-medium text-ink">{viewer?.name ?? viewerName ?? "You"}</p>
                <p className="text-xs text-ink-soft">You</p>
              </div>
            </div>
          </div>
          {data.currencies.length === 0 ? (
            <p className="pt-4 text-ink-soft">
              {data.missingPayers.length
                ? "Assign payers to calculate what everyone owes."
                : "No outstanding balances."}
            </p>
          ) : (
            data.currencies.map((group) => {
              const members = group.members.filter(
                (member) =>
                  member.memberId !== data.viewerMemberId && memberDirectBalance(member) !== 0,
              );
              const owedCents = members.reduce(
                (sum, member) => sum + Math.max(0, Math.round(memberDirectBalance(member) * 100)),
                0,
              );
              const oweCents = members.reduce(
                (sum, member) => sum + Math.max(0, -Math.round(memberDirectBalance(member) * 100)),
                0,
              );
              return (
                <section
                  key={group.currency}
                  aria-label={`${group.currency} balances`}
                  className="bleed"
                >
                  <div className="flex min-h-11 flex-wrap items-center justify-between gap-3 bleed-px py-2">
                    <span className="rounded-full border border-rule bg-chip-neutral px-3 py-1 font-numeric text-xs font-semibold text-ink">
                      {group.currency}
                    </span>
                    <div className="flex gap-4 sm:gap-6">
                      {owedCents > 0 && (
                        <p className="flex flex-col text-right sm:block">
                          <span className="text-sm text-ink-soft">You are owed</span>{" "}
                          <span className="font-numeric font-semibold text-ledger-green">
                            {currency(owedCents / 100, group.currency)}
                          </span>
                        </p>
                      )}
                      {oweCents > 0 && (
                        <p className="flex flex-col text-right sm:block">
                          <span className="text-sm text-ink-soft">You owe</span>{" "}
                          <span className="font-numeric font-semibold text-margin-red-ink">
                            {currency(oweCents / 100, group.currency)}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                  <ul className="divide-y divide-rule border-y border-edge bg-field">
                    {members.length === 0 && (
                      <li className="bleed-px py-3 text-sm text-ink-soft">
                        No outstanding balances.
                      </li>
                    )}
                    {members.map((member) => {
                      const balance = memberDirectBalance(member);
                      const expenseCount = relatedExpenseCount(
                        expenses,
                        expenseView,
                        asOfDate,
                        group.currency,
                        data.viewerMemberId!,
                        member.memberId,
                      );
                      return (
                        <li key={member.memberId}>
                          <button
                            type="button"
                            aria-haspopup="dialog"
                            aria-label={`View ${member.name}'s ${group.currency} expenses`}
                            onClick={() => onMemberClick?.(member.memberId, group.currency)}
                            className="group flex min-h-16 w-full min-w-0 items-center justify-between gap-3 bleed-px py-3 text-left transition-colors hover:bg-wash active:bg-wash focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-forest"
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <MemberAvatar id={member.memberId} name={member.name} size="md" />
                              <span className="min-w-0 break-words">
                                <span className="block text-ink">
                                  {balance > 0 ? (
                                    <>
                                      <span className="font-medium">{member.name}</span> owes you{" "}
                                    </>
                                  ) : balance < 0 ? (
                                    <>
                                      You owe <span className="font-medium">
                                        {member.name}
                                      </span>{" "}
                                    </>
                                  ) : null}
                                  <span
                                    className={`font-numeric font-semibold ${balance > 0 ? "text-ledger-green" : "text-margin-red-ink"}`}
                                  >
                                    {currency(Math.abs(balance), group.currency)}
                                  </span>
                                </span>
                                <span className="mt-1 block text-xs text-ink-soft">
                                  {expenseCount} {expenseCount === 1 ? "expense" : "expenses"}
                                </span>
                              </span>
                            </span>
                            <ChevronRight
                              aria-hidden="true"
                              className="-mr-1 h-5 w-5 shrink-0 self-center text-ink-soft chevron-x"
                            />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })
          )}
        </>
      )}
    </div>
  );
}

export function TabSettlement({
  slug,
  members,
  canManage,
  defaultCurrency = "USD",
  expenses = [],
  expenseView = "paid",
}: {
  slug: string;
  members: Member[];
  canManage: boolean;
  defaultCurrency?: string;
  expenses?: TabExpenseSummary[];
  expenseView?: ExpenseView;
}) {
  const { currency } = useLocaleFormatters();
  const [day, setDay] = useState(todayISODate);
  const [memberBreakdownOpen, setMemberBreakdownOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<{
    memberId: string;
    currency: string;
    name: string;
  } | null>(null);
  const [selectedExpenseSlug, setSelectedExpenseSlug] = useState<string | null>(null);
  const response = useQuery(api.settlements.get, { slug, asOfDate: day }) as
    | SettlementQueryResponse
    | null
    | undefined;
  const breakdown = useTabBreakdown(slug, expenseView, day);

  useEffect(() => {
    const refresh = () => setDay(todayISODate());
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  if (response === undefined)
    return (
      <Panel bleedOnMobile className="@container card-inset" role="region" aria-label="Balances">
        <p role="status" className="text-sm text-ink-soft">
          Loading settlement balances…
        </p>
      </Panel>
    );
  if (response === null) return null;

  const data = "paid" in response ? response[expenseView] : response;
  const selectedBreakdown = selectedMember
    ? breakdown?.currencies
        .find((group) => group.currency === selectedMember.currency)
        ?.members.find((member) => member.memberId === selectedMember.memberId)
    : undefined;
  const selectedBalance = selectedMember
    ? data.currencies
        .find((group) => group.currency === selectedMember.currency)
        ?.members.find((member) => member.memberId === selectedMember.memberId)
    : undefined;
  const selectedExpense = expenses.find((expense) => expense.slug === selectedExpenseSlug);

  function openMemberExpenses(memberId: string, currencyCode: string) {
    const member = data.currencies
      .find((group) => group.currency === currencyCode)
      ?.members.find((row) => row.memberId === memberId);
    if (member) {
      setSelectedMember({ memberId, currency: currencyCode, name: member.name });
      setMemberBreakdownOpen(true);
    }
  }

  return (
    <Panel bleedOnMobile className="@container card-inset" role="region" aria-label="Balances">
      <SettlementSummary
        data={data}
        viewerName={members.find((member) => member.id === data.viewerMemberId)?.name}
        expenses={expenses}
        expenseView={expenseView}
        asOfDate={day}
        canManage={canManage}
        onMemberClick={openMemberExpenses}
      />
      <Dialog open={memberBreakdownOpen} onOpenChange={setMemberBreakdownOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-5rem)] max-w-2xl flex-col overflow-hidden p-0 sm:p-0">
          <header className="shrink-0 border-b border-rule/70 bg-surface p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {selectedBreakdown && (
                  <MemberAvatar
                    id={selectedBreakdown.memberId}
                    name={selectedBreakdown.name}
                    size="md"
                  />
                )}
                <div className="min-w-0">
                  <DialogTitle>{selectedMember?.name ?? "Member expenses"}</DialogTitle>
                  <DialogDescription className="mt-1 text-xs">
                    {selectedBreakdown
                      ? `${selectedBreakdown.expenses.filter((line) => line.sharedWithViewer).length} ${selectedBreakdown.expenses.filter((line) => line.sharedWithViewer).length === 1 ? "expense" : "expenses"}`
                      : "Expenses"}
                  </DialogDescription>
                </div>
              </div>
              <DialogClose
                aria-label="Close member expenses"
                render={<Button variant="ghost" size="icon-touch" className="text-ink-soft" />}
              >
                <X aria-hidden="true" />
              </DialogClose>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto card-inset">
            {breakdown === undefined ? (
              <p role="status" className="text-sm text-ink-soft">
                Loading expenses…
              </p>
            ) : selectedBreakdown && selectedMember ? (
              <>
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 pb-4">
                  <span className="inline-flex rounded-full border border-rule bg-chip-neutral px-3 py-1 font-numeric text-xs font-semibold text-ink">
                    {selectedMember.currency}
                  </span>
                  {selectedBalance && memberDirectBalance(selectedBalance) !== 0 && (
                    <p className="text-right text-sm">
                      <span className="text-ink-soft">
                        {memberDirectBalance(selectedBalance) > 0 ? "You are owed" : "You owe"}
                      </span>{" "}
                      <span
                        className={`font-numeric font-semibold ${memberDirectBalance(selectedBalance) > 0 ? "text-ledger-green" : "text-margin-red-ink"}`}
                      >
                        {currency(
                          Math.abs(memberDirectBalance(selectedBalance)),
                          selectedMember.currency,
                        )}
                      </span>
                    </p>
                  )}
                </div>
                <TabMemberBreakdown
                  member={selectedBreakdown}
                  currencyCode={selectedMember.currency}
                  onExpenseClick={(expenseSlug) => {
                    setMemberBreakdownOpen(false);
                    setSelectedExpenseSlug(expenseSlug);
                  }}
                />
              </>
            ) : (
              <p className="text-sm text-ink-soft">No expenses available.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <ExpenseDetailsDialog
        open={selectedExpenseSlug !== null}
        onOpenChange={(next) => {
          if (!next) setSelectedExpenseSlug(null);
        }}
        expense={selectedExpense}
        slug={slug}
        defaultCurrency={defaultCurrency}
        canManage={canManage}
        members={members}
      />
    </Panel>
  );
}

export function SettlementActions({
  slug,
  members,
  expenseView,
}: {
  slug: string;
  members: Member[];
  expenseView: ExpenseView;
}) {
  const [paymentHistoryOpen, setPaymentHistoryOpen] = useState(false);
  const { currency, formatExpenseDate } = useLocaleFormatters();
  const response = useQuery(api.settlements.get, { slug, asOfDate: todayISODate() });
  if (!response) return null;
  const data = "paid" in response ? response[expenseView] : response;
  const historyByDate = data.history.reduce<Map<string, typeof data.history>>((groups, payment) => {
    const group = groups.get(payment.date) ?? [];
    group.push(payment);
    groups.set(payment.date, group);
    return groups;
  }, new Map());
  const canRecordPayment = data.currencies.some((group) =>
    group.members.some(
      (member) => member.memberId !== data.viewerMemberId && memberDirectBalance(member) !== 0,
    ),
  );
  if (!data.viewerMemberId) return null;
  return (
    <>
      <Button
        variant="secondary"
        size="touch"
        className="min-w-0 w-full md:w-auto"
        onClick={() => setPaymentHistoryOpen(true)}
      >
        <History aria-hidden="true" className="h-4 w-4" />
        Payment history
      </Button>
      {expenseView !== "upcoming" && canRecordPayment ? (
        <Button
          size="touch"
          nativeButton={false}
          className="min-w-0 w-full md:w-auto"
          render={<Link to="/t/$slug/payment" params={{ slug }} search={{ view: expenseView }} />}
        >
          <Banknote aria-hidden="true" className="h-4 w-4" />
          Record payment
        </Button>
      ) : (
        <Button size="touch" className="min-w-0 w-full md:w-auto" disabled>
          <Banknote aria-hidden="true" className="h-4 w-4" />
          Record payment
        </Button>
      )}
      <Dialog open={paymentHistoryOpen} onOpenChange={setPaymentHistoryOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-5rem)] flex-col overflow-hidden p-0 sm:p-0">
          <header className="shrink-0 border-b border-rule/70 bg-surface p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle>Payment history</DialogTitle>
                <DialogDescription className="mt-1">
                  {data.history.length} recorded{" "}
                  {data.history.length === 1 ? "payment" : "payments"}.
                </DialogDescription>
              </div>
              <DialogClose
                aria-label="Close payment history"
                render={<Button variant="ghost" size="icon-touch" className="text-ink-soft" />}
              >
                <X aria-hidden="true" />
              </DialogClose>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto card-inset pt-0">
            {data.history.length === 0 ? (
              <p className="text-sm text-ink-soft">No payments recorded.</p>
            ) : (
              <ul className="bleed bg-field">
                {[...historyByDate].map(([date, payments]) => {
                  const currencyGroups = [
                    ...payments.reduce<Map<string, typeof payments>>((groups, payment) => {
                      const group = groups.get(payment.currency) ?? [];
                      group.push(payment);
                      groups.set(payment.currency, group);
                      return groups;
                    }, new Map()),
                  ];
                  return (
                    <li key={date}>
                      <h3 className="bleed-px border-b border-rule bg-surface py-2 text-sm font-semibold text-ink">
                        <time dateTime={date}>{formatExpenseDate(date) ?? date}</time>
                      </h3>
                      <ul className="bg-field">
                        {currencyGroups.map(([currencyCode, currencyPayments], groupIndex) => (
                          <li
                            key={currencyCode}
                            className={groupIndex > 0 ? "border-t border-rule" : ""}
                          >
                            <div className="flex justify-start bg-surface py-2 bleed-px">
                              <span className="inline-flex rounded-full border border-rule bg-chip-neutral px-3 py-1 font-numeric text-xs font-semibold text-ink">
                                {currencyCode}
                              </span>
                            </div>
                            <ul
                              className={`divide-y divide-rule ${groupIndex === 0 ? "border-t border-edge" : ""} ${groupIndex === currencyGroups.length - 1 ? "border-b border-edge" : ""}`}
                            >
                              {currencyPayments.map((payment) => {
                                const payerName =
                                  members.find((member) => member.id === payment.fromMemberId)
                                    ?.name ?? "Former member";
                                return (
                                  <li
                                    key={payment.id}
                                    className="flex min-w-0 items-center gap-3 py-3 bleed-px"
                                  >
                                    <MemberAvatar
                                      id={payment.fromMemberId}
                                      name={payerName}
                                      size="md"
                                    />
                                    <div className="min-w-0 flex-1 text-left">
                                      <p className="break-words text-sm text-ink">
                                        <span className="font-medium">{payerName}</span> paid{" "}
                                        <span className="font-medium">
                                          {members.find(
                                            (member) => member.id === payment.toMemberId,
                                          )?.name ?? "Former member"}
                                        </span>
                                      </p>
                                      {(payment.view === "upcoming" || payment.reversed) && (
                                        <p className="mt-1 text-xs text-ink-soft">
                                          {payment.view === "upcoming" && "Upcoming expenses"}
                                          {payment.view === "upcoming" && payment.reversed && " · "}
                                          {payment.reversed && "Reversed"}
                                        </p>
                                      )}
                                    </div>
                                    <span className="shrink-0 font-numeric text-sm font-semibold text-ink">
                                      {currency(payment.amount, payment.currency)}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
