import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArrowLeft, Banknote, ChevronRight, History, Undo2, X } from "lucide-react";

import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
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
export type TabSettlementResponse = FunctionReturnType<typeof api.settlements.get>;
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
    reversedAt?: number;
    reversalOf?: string;
    createdAt?: number;
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
  asOfDate,
  response,
}: {
  slug: string;
  members: Member[];
  canManage: boolean;
  defaultCurrency?: string;
  expenses?: TabExpenseSummary[];
  expenseView?: ExpenseView;
  asOfDate: string;
  response: TabSettlementResponse;
}) {
  const { currency } = useLocaleFormatters();
  const [memberBreakdownOpen, setMemberBreakdownOpen] = useState(false);
  const [deletingExpenseSlug, setDeletingExpenseSlug] = useState<string | null>(null);
  const removeExpense = useMutation(api.expenses.remove);
  const [selectedMember, setSelectedMember] = useState<{
    memberId: string;
    currency: string;
    name: string;
  } | null>(null);
  const [selectedExpenseSlug, setSelectedExpenseSlug] = useState<string | null>(null);
  const breakdown = useTabBreakdown(slug, expenseView, asOfDate);

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
        asOfDate={asOfDate}
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
                  expenseStatuses={data.expenseStatuses}
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
          {selectedMember && (
            <footer className="flex shrink-0 justify-end border-t border-rule/70 bg-surface px-5 py-4 sm:px-6">
              <Button
                size="touch"
                nativeButton={false}
                className="w-full sm:w-auto"
                render={
                  <Link
                    to="/t/$slug/payment"
                    params={{ slug }}
                    search={{
                      view: expenseView,
                      memberId: selectedMember.memberId,
                      currency: selectedMember.currency,
                    }}
                  />
                }
              >
                <Banknote aria-hidden="true" className="h-4 w-4" />
                Record payment
              </Button>
            </footer>
          )}
        </DialogContent>
      </Dialog>
      <ExpenseDetailsDialog
        open={selectedExpenseSlug !== null}
        onOpenChange={(next) => {
          if (!next) setSelectedExpenseSlug(null);
        }}
        onBack={() => {
          setSelectedExpenseSlug(null);
          setMemberBreakdownOpen(true);
        }}
        expense={selectedExpense}
        expenseStatuses={data.expenseStatuses}
        viewerMemberId={data.viewerMemberId}
        slug={slug}
        defaultCurrency={defaultCurrency}
        canManage={canManage}
        members={members}
        onDelete={canManage ? setDeletingExpenseSlug : undefined}
      />
      <ConfirmDialog
        open={deletingExpenseSlug !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingExpenseSlug(null);
        }}
        title="Delete this expense?"
        description={
          deletingExpenseSlug ? (
            <>
              You are deleting{" "}
              <strong className="font-semibold text-ink">
                {expenses.find((expense) => expense.slug === deletingExpenseSlug)?.name ??
                  "Untitled expense"}
              </strong>
              , this can’t be undone.
            </>
          ) : null
        }
        confirmLabel="Delete expense"
        pendingLabel="Deleting…"
        onConfirm={async () => {
          if (!deletingExpenseSlug) return;
          await removeExpense({ slug: deletingExpenseSlug });
          setSelectedExpenseSlug(null);
        }}
      />
    </Panel>
  );
}

function paymentDateLabel(
  createdAt: number | undefined,
  date: string,
  formatDate: (date: string) => string | undefined,
  locale: string,
) {
  return createdAt
    ? new Date(createdAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })
    : (formatDate(date) ?? date);
}

function PaymentSummary({
  payerId,
  payerName,
  recipientName,
  amount,
  currencyCode,
  createdAt,
  date,
  formatDate,
  locale,
  reversal = false,
}: {
  payerId: string;
  payerName: string;
  recipientName: string;
  amount: number;
  currencyCode: string;
  createdAt?: number;
  date: string;
  formatDate: (date: string) => string | undefined;
  locale: string;
  reversal?: boolean;
}) {
  const { currency } = useLocaleFormatters();
  return (
    <div className="rounded-lg bg-field p-4">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <MemberAvatar id={payerId} name={payerName} size="lg" />
        <div className="min-w-[8rem] flex-1 break-words">
          <p className="font-medium text-ink">{payerName}</p>
          <p className="break-words text-sm text-ink-soft">
            {reversal ? "Payment reversal to" : "paid"} {recipientName}
          </p>
        </div>
        <div className="ml-auto max-w-full shrink-0 text-right">
          <p
            className={`whitespace-nowrap font-numeric text-2xl font-semibold ${reversal ? "text-margin-red-ink" : "text-ink"}`}
          >
            {reversal && "−"}
            {currency(amount, currencyCode)}
          </p>
          <p className="text-xs text-ink-soft">{currencyCode}</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-ink-soft">
        <time
          dateTime={createdAt ? new Date(createdAt).toISOString() : date}
          className="break-words"
        >
          {paymentDateLabel(createdAt, date, formatDate, locale)}
        </time>
      </p>
    </div>
  );
}

function PaymentActivity({
  payment,
  reversal,
  currency,
  locale,
  formatDate,
}: {
  payment: SettlementSummaryData["history"][number];
  reversal?: SettlementSummaryData["history"][number];
  currency: (amount: number, currencyCode: string) => string;
  locale: string;
  formatDate: (date: string) => string | undefined;
}) {
  const originalDate = payment.createdAt;
  const reversalDate = reversal?.createdAt ?? payment.reversedAt;
  const timestamp = (value: number) =>
    new Date(value).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
  return (
    <section
      className="mt-4 border-t border-rule pt-4"
      aria-label="Payment activity"
      aria-live="polite"
    >
      <h3 className="font-display text-lg font-semibold text-ink">Payment activity</h3>
      <ol className="mt-3 grid gap-4">
        <li className="grid min-w-0 grid-cols-[0.75rem_minmax(0,1fr)_max-content] items-start gap-3">
          <span aria-hidden="true" className="mt-1 size-3 rounded-full bg-forest" />
          <span className="min-w-0">
            <span className="block text-sm text-ink">Payment recorded</span>
            <time
              className="block break-words text-sm text-ink-soft"
              dateTime={originalDate ? new Date(originalDate).toISOString() : payment.date}
            >
              {originalDate ? timestamp(originalDate) : (formatDate(payment.date) ?? payment.date)}
            </time>
          </span>
          <span className="whitespace-nowrap font-numeric text-sm font-semibold text-ink">
            +{currency(payment.amount, payment.currency)}
          </span>
        </li>
        <li className="grid min-w-0 grid-cols-[0.75rem_minmax(0,1fr)_max-content] items-start gap-3">
          <span aria-hidden="true" className="mt-1 size-3 rounded-full bg-margin-red" />
          <span className="min-w-0">
            <span className="block text-sm text-ink">Payment reversed</span>
            <time
              className="block break-words text-sm text-ink-soft"
              dateTime={
                reversalDate ? new Date(reversalDate).toISOString() : (reversal?.date ?? "")
              }
            >
              {reversalDate
                ? timestamp(reversalDate)
                : reversal
                  ? (formatDate(reversal.date) ?? reversal.date)
                  : "Date unavailable"}
            </time>
          </span>
          <span className="whitespace-nowrap font-numeric text-sm font-semibold text-margin-red-ink">
            −{currency(reversal?.amount ?? payment.amount, reversal?.currency ?? payment.currency)}
          </span>
        </li>
      </ol>
    </section>
  );
}

export function SettlementActions({
  slug,
  members,
  expenseView,
  response,
}: {
  slug: string;
  members: Member[];
  expenseView: ExpenseView;
  response?: TabSettlementResponse;
}) {
  const [paymentDialogView, setPaymentDialogView] = useState<
    "manage" | "history" | "details" | null
  >(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [paymentToReverse, setPaymentToReverse] = useState<string | null>(null);
  const detailsCloseRef = useRef<HTMLButtonElement>(null);
  const detailsTriggerRef = useRef<HTMLButtonElement>(null);
  const reversePayment = useMutation(api.settlements.reverse);
  const { currency, formatExpenseDate, locale } = useLocaleFormatters();
  const queriedResponse = useQuery(
    api.settlements.get,
    response === undefined ? { slug, asOfDate: todayISODate() } : "skip",
  );
  const result = response === undefined ? queriedResponse : response;
  if (!result) return null;
  const data = "paid" in result ? result[expenseView] : result;
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
  const selectedEntry = data.history.find((payment) => payment.id === selectedPaymentId);
  const originalPayment = selectedEntry?.reversalOf
    ? data.history.find((payment) => payment.id === selectedEntry.reversalOf)
    : selectedEntry;
  const linkedReversal = originalPayment
    ? data.history.find((payment) => payment.reversalOf === originalPayment.id)
    : undefined;
  const selectedPayment = originalPayment ?? selectedEntry;
  const selectedPayerName =
    members.find((member) => member.id === selectedPayment?.fromMemberId)?.name ?? "Former member";
  const selectedRecipientName =
    members.find((member) => member.id === selectedPayment?.toMemberId)?.name ?? "Former member";
  if (!data.viewerMemberId) return null;
  return (
    <>
      <Button
        size="touch"
        className="flex-1 md:flex-none"
        onClick={() => setPaymentDialogView("manage")}
      >
        Manage payments
      </Button>
      <Dialog
        open={paymentDialogView !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPaymentDialogView(null);
            setSelectedPaymentId(null);
          }
        }}
      >
        <DialogContent
          screenKey={paymentDialogView ?? undefined}
          initialFocus={
            paymentDialogView === "details"
              ? detailsCloseRef
              : paymentDialogView === "history" && selectedPaymentId
                ? detailsTriggerRef
                : undefined
          }
          className="flex max-h-[calc(100dvh-5rem)] flex-col overflow-hidden p-0 sm:p-0"
        >
          {paymentDialogView === "history" ? (
            <>
              <header className="shrink-0 border-b border-rule/70 bg-surface p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon-touch"
                      aria-label="Back to manage payments"
                      autoFocus={!selectedPaymentId}
                      onClick={() => {
                        setSelectedPaymentId(null);
                        setPaymentDialogView("manage");
                      }}
                    >
                      <ArrowLeft aria-hidden="true" />
                    </Button>
                    <div className="min-w-0">
                      <DialogTitle>Payment history</DialogTitle>
                      <DialogDescription className="mt-1">
                        {data.history.length} recorded{" "}
                        {data.history.length === 1 ? "payment" : "payments"}.
                      </DialogDescription>
                    </div>
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
                  <p className="pt-5 text-sm text-ink-soft sm:pt-6">No payments recorded.</p>
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
                                    const recipientName =
                                      members.find((member) => member.id === payment.toMemberId)
                                        ?.name ?? "Former member";
                                    const linkedOriginal = data.history.find(
                                      (original) => original.id === payment.reversalOf,
                                    );
                                    const originalPayerName = linkedOriginal
                                      ? (members.find(
                                          (member) => member.id === linkedOriginal.fromMemberId,
                                        )?.name ?? "Former member")
                                      : payerName;
                                    const originalRecipientName = linkedOriginal
                                      ? (members.find(
                                          (member) => member.id === linkedOriginal.toMemberId,
                                        )?.name ?? "Former member")
                                      : recipientName;
                                    const rowPayer = payment.reversalOf
                                      ? originalPayerName
                                      : payerName;
                                    const rowRecipient = payment.reversalOf
                                      ? originalRecipientName
                                      : recipientName;
                                    return (
                                      <li key={payment.id} className="min-w-0">
                                        <Button
                                          ref={
                                            selectedPaymentId === payment.id
                                              ? detailsTriggerRef
                                              : undefined
                                          }
                                          variant="row"
                                          size="row"
                                          aria-label={`${payment.reversalOf ? "View reversal" : "View payment"} of ${currency(payment.amount, payment.currency)} from ${rowPayer} to ${rowRecipient} on ${formatExpenseDate(payment.date) ?? payment.date}`}
                                          autoFocus={selectedPaymentId === payment.id}
                                          onClick={(event) => {
                                            detailsTriggerRef.current = event.currentTarget;
                                            setSelectedPaymentId(payment.id);
                                            setPaymentDialogView("details");
                                          }}
                                        >
                                          {payment.reversalOf ? (
                                            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-margin-red-ink">
                                              <Undo2 aria-hidden="true" className="size-5" />
                                            </span>
                                          ) : (
                                            <MemberAvatar
                                              id={payment.fromMemberId}
                                              name={payerName}
                                              size="lg"
                                            />
                                          )}
                                          <span className="min-w-0 text-left">
                                            <span className="block break-words text-sm text-ink">
                                              <span className="font-medium">{rowPayer}</span> →{" "}
                                              <span className="font-medium">{rowRecipient}</span>
                                            </span>
                                            {(payment.view === "upcoming" ||
                                              payment.reversed ||
                                              payment.reversalOf) && (
                                              <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                                                {payment.view === "upcoming" && "Upcoming expenses"}
                                                {payment.reversed && (
                                                  <span className="rounded-full bg-chip-neutral px-2 py-0.5 text-ink">
                                                    Reversed
                                                  </span>
                                                )}
                                                {payment.reversalOf && "Payment reversal"}
                                              </span>
                                            )}
                                          </span>
                                          <span
                                            className={`ml-auto text-right font-numeric text-sm font-semibold ${payment.reversalOf ? "text-margin-red-ink" : "text-ink"}`}
                                          >
                                            {payment.reversalOf && "−"}
                                            {currency(payment.amount, payment.currency)}
                                          </span>
                                        </Button>
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
            </>
          ) : paymentDialogView === "details" ? (
            <>
              <header className="flex shrink-0 items-start justify-between gap-3 border-b border-rule/70 p-5 sm:p-6">
                <div className="flex min-w-0 items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon-touch"
                    aria-label="Back to payment history"
                    onClick={() => setPaymentDialogView("history")}
                  >
                    <ArrowLeft aria-hidden="true" />
                  </Button>
                  <div className="min-w-0">
                    <DialogTitle>Payment details</DialogTitle>
                    {selectedPayment?.reversed && (
                      <span className="mt-2 inline-flex rounded-full bg-chip-neutral px-3 py-1 text-xs font-medium text-ink">
                        Reversed
                      </span>
                    )}
                  </div>
                </div>
                <DialogClose
                  aria-label="Close payment details"
                  render={
                    <Button
                      ref={detailsCloseRef}
                      variant="ghost"
                      size="icon-touch"
                      className="text-ink-soft"
                    />
                  }
                >
                  <X aria-hidden="true" />
                </DialogClose>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
                {selectedPayment ? (
                  <>
                    <PaymentSummary
                      payerId={selectedPayment.fromMemberId}
                      payerName={selectedPayerName}
                      recipientName={selectedRecipientName}
                      amount={selectedPayment.amount}
                      currencyCode={selectedPayment.currency}
                      createdAt={selectedPayment.createdAt}
                      date={selectedPayment.date}
                      formatDate={formatExpenseDate}
                      locale={locale}
                      reversal={Boolean(selectedEntry?.reversalOf && !originalPayment)}
                    />
                    {linkedReversal || selectedPayment.reversed ? (
                      <PaymentActivity
                        payment={selectedPayment}
                        reversal={linkedReversal}
                        currency={currency}
                        locale={locale}
                        formatDate={formatExpenseDate}
                      />
                    ) : selectedEntry?.reversalOf ? (
                      <p className="mt-4 text-sm text-ink-soft">
                        The original payment is no longer available.
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p role="alert" className="text-sm text-margin-red-ink">
                    This payment is no longer available.
                  </p>
                )}
              </div>
              {selectedPayment &&
                !selectedPayment.reversed &&
                !selectedPayment.reversalOf &&
                !linkedReversal && (
                  <footer className="shrink-0 border-t border-rule/70 p-5 sm:p-6">
                    <Button
                      variant="destructive"
                      size="touch"
                      className="w-full"
                      aria-label="Reverse payment"
                      onClick={() => setPaymentToReverse(selectedPayment.id)}
                    >
                      Reverse payment
                    </Button>
                  </footer>
                )}
            </>
          ) : (
            <>
              <header className="flex shrink-0 items-start justify-between gap-3 border-b border-rule/70 p-5 sm:p-6">
                <div className="min-w-0">
                  <DialogTitle>Manage payments</DialogTitle>
                  <DialogDescription className="mt-1">
                    Record a payment or review past payments.
                  </DialogDescription>
                </div>
                <DialogClose
                  aria-label="Close manage payments"
                  render={<Button variant="ghost" size="icon-touch" className="text-ink-soft" />}
                >
                  <X aria-hidden="true" />
                </DialogClose>
              </header>
              <div className="grid gap-3 p-5 sm:p-6">
                {expenseView !== "upcoming" && canRecordPayment ? (
                  <Button
                    size="touch"
                    nativeButton={false}
                    autoFocus
                    className="w-full justify-start"
                    render={
                      <Link
                        to="/t/$slug/payment"
                        params={{ slug }}
                        search={{ view: expenseView }}
                      />
                    }
                  >
                    <Banknote aria-hidden="true" className="h-4 w-4" />
                    Record payment
                  </Button>
                ) : (
                  <Button size="touch" className="w-full justify-start" disabled>
                    <Banknote aria-hidden="true" className="h-4 w-4" />
                    Record payment
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="touch"
                  autoFocus={expenseView === "upcoming" || !canRecordPayment}
                  className="w-full justify-start"
                  onClick={() => setPaymentDialogView("history")}
                >
                  <History aria-hidden="true" className="h-4 w-4" />
                  View payment history
                </Button>
              </div>
            </>
          )}
        </DialogContent>
        <ConfirmDialog
          open={paymentToReverse !== null}
          onOpenChange={(open) => {
            if (!open) setPaymentToReverse(null);
          }}
          title="Reverse this payment?"
          description="A reversal record will be added and balances updated."
          finalFocus={detailsCloseRef}
          details={
            selectedPayment && (
              <PaymentSummary
                payerId={selectedPayment.fromMemberId}
                payerName={selectedPayerName}
                recipientName={selectedRecipientName}
                amount={selectedPayment.amount}
                currencyCode={selectedPayment.currency}
                createdAt={selectedPayment.createdAt}
                date={selectedPayment.date}
                formatDate={formatExpenseDate}
                locale={locale}
              />
            )
          }
          confirmLabel="Reverse payment"
          pendingLabel="Reversing…"
          onConfirm={async () => {
            if (
              !selectedPayment ||
              selectedPayment.id !== paymentToReverse ||
              selectedPayment.reversed ||
              selectedPayment.reversalOf ||
              linkedReversal
            )
              throw new Error("Payment already reversed.");
            await reversePayment({
              slug,
              settlementId: selectedPayment.id as Parameters<
                typeof reversePayment
              >[0]["settlementId"],
              date: todayISODate(),
            });
          }}
        />
      </Dialog>
    </>
  );
}
