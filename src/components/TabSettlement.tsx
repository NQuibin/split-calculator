import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Banknote, ChevronRight, MoveDown, MoveUp, RotateCcw, Scale, X } from "lucide-react";

import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DatePicker } from "@/components/ui/DatePicker";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/Input";
import { MemberAvatar } from "@/components/MemberAvatar";
import { TabMemberBreakdown } from "@/components/TabMemberBreakdown";
import { ExpenseDetailsDialog } from "@/components/ExpenseDetailsDialog";
import { Panel } from "@/components/ui/Page";
import { GroupTitle, SectionTitle } from "@/components/ui/Typography";
import { CURRENCIES } from "@/lib/currencies";
import { currency, formatExpenseDate, todayISODate } from "@/lib/format";
import { useTabBreakdown, type TabExpenseSummary } from "@/lib/tabSync";
import type { ExpenseView } from "@/components/ExpenseViewTabs";

type Member = { id: string; name: string };
type SettlementResponse = NonNullable<FunctionReturnType<typeof api.settlements.get>>;
type SettlementData = SettlementResponse["paid"];
type SettlementQueryResponse = SettlementResponse | SettlementData;
type CurrencySettlement = SettlementData["currencies"][number];
type SettlementMember = CurrencySettlement["members"][number];
type PaymentDraft = {
  fromMemberId: SettlementMember["memberId"];
  toMemberId: SettlementMember["memberId"];
  currency: string;
  expenseView: ExpenseView;
  amountText: string;
  date: string;
  note: string;
};
export type SettlementSummaryData = {
  viewerMemberId: string | null;
  missingPayers: { slug: string; name: string }[];
  currencies: {
    currency: string;
    /**
     * `share` is what this member's split came to - the same figure the spend
     * summary card used to show on its own. It rides on this snapshot rather
     * than a second query, so the two money columns always describe the same
     * set of expenses at the same as-of date. Optional because a client open
     * across the consolidated-query rollout can still receive a response
     * without it; that renders as no spend column rather than a column of
     * blanks.
     */
    members: {
      memberId: string;
      name: string;
      balance: number;
      share?: number;
      paidFor?: number;
    }[];
  }[];
};

function balanceColor(balance: number) {
  return balance > 0 ? "text-ledger-green" : balance < 0 ? "text-margin-red-ink" : "text-ink";
}

function BalanceLabel({ balance, code }: { balance: number; code: string }) {
  return (
    <span className={`${balanceColor(balance)} whitespace-nowrap`}>
      {balance === 0 ? "Settled" : balance > 0 ? "Gets " : "Owes "}
      {balance !== 0 && <span className="font-numeric">{currency(Math.abs(balance), code)}</span>}
    </span>
  );
}

function BalanceDirection({ balance }: { balance: number }) {
  if (balance === 0) return null;
  const DirectionIcon = balance > 0 ? MoveUp : MoveDown;
  return (
    <DirectionIcon
      aria-hidden="true"
      className={`h-5 w-5 shrink-0 ${balanceColor(balance)}`}
      strokeWidth={2.5}
    />
  );
}

function BalanceValue({ balance, code }: { balance: number; code: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <BalanceLabel balance={balance} code={code} />
      <BalanceDirection balance={balance} />
    </span>
  );
}

/**
 * One template for the header, the rows and the totals footer, so the two money
 * columns line up down the whole currency group. Fixed tracks are enough here
 * (unlike the expense list, which needed a subgrid): every cell in these
 * columns is a bounded money string, so no row can size a track differently
 * from its neighbours.
 *
 * Below `sm` there's only room for member + balance, so spend drops to a
 * sub-line under the name and the column labels go with it. Each variant is a
 * complete literal string rather than a prefix glued to an interpolated
 * value - Tailwind's scanner only sees class names that appear intact in the
 * source (DESIGN.md § 6).
 */
const balanceRowGrid = {
  withSpend:
    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 @min-[29.5rem]:grid-cols-[minmax(0,1fr)_7rem_9.5rem] @min-[29.5rem]:gap-x-4",
  withSpendAndPaidFor:
    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 @min-[29.5rem]:grid-cols-[minmax(0,1fr)_5rem_7rem_9.5rem] @min-[29.5rem]:gap-x-4",
  withPaidFor:
    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 @min-[29.5rem]:grid-cols-[minmax(0,1fr)_5rem_9.5rem] @min-[29.5rem]:gap-x-4",
  balanceOnly:
    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 @min-[29.5rem]:grid-cols-[minmax(0,1fr)_9.5rem] @min-[29.5rem]:gap-x-4",
};

function SingleCurrencySummaryList({
  data,
  onMemberClick,
}: {
  data: SettlementSummaryData;
  onMemberClick?: (memberId: string, currencyCode: string) => void;
}) {
  return (
    <div className="space-y-5">
      {data.currencies.map((group) => {
        const currencyName = CURRENCIES.find((option) => option.code === group.currency)?.name;
        const members = [...group.members].sort(
          (a, b) =>
            Number(b.memberId === data.viewerMemberId) - Number(a.memberId === data.viewerMemberId),
        );
        // A response from before the consolidated query carries no `share`, so
        // the spend column is dropped wholesale rather than rendered blank.
        const hasSpend = members.some((member) => member.share !== undefined);
        // `paidFor` is optional for legacy responses during a rolling deploy.
        const hasPaidFor = members.some((member) => member.paidFor !== undefined);
        const grid = hasSpend
          ? hasPaidFor
            ? balanceRowGrid.withSpendAndPaidFor
            : balanceRowGrid.withSpend
          : hasPaidFor
            ? balanceRowGrid.withPaidFor
            : balanceRowGrid.balanceOnly;
        return (
          <section key={group.currency} aria-label={`${group.currency} balances`} className="bleed">
            <GroupTitle as="h3" className={`${grid} bleed-px py-2 text-xs`}>
              <span className="min-w-0">
                <span className="font-numeric">{group.currency}</span>
                {currencyName && (
                  <span className="font-normal text-ink-soft"> · {currencyName}</span>
                )}
              </span>
              {hasPaidFor && (
                <span className="hidden text-right text-xs font-medium uppercase text-ink-soft @min-[29.5rem]:block">
                  Paid for
                </span>
              )}
              {hasSpend && (
                <span className="hidden text-right text-xs font-medium uppercase text-ink-soft @min-[29.5rem]:block">
                  Spent
                </span>
              )}
              <span className="hidden text-right text-xs font-medium uppercase text-ink-soft @min-[29.5rem]:block">
                Balance
              </span>
            </GroupTitle>
            {/* The body owns both rules, so the table closes top and bottom
                whether or not a header or totals row renders around it - see
                DESIGN.md "Data tables". */}
            <ul className="divide-y divide-rule border-y border-edge bg-field">
              {members.map((member) => {
                const isViewer = member.memberId === data.viewerMemberId;
                // A member with no share in this currency spent nothing in it,
                // which reads better as "No expenses" than as a zero amount.
                const spent = member.share ? currency(member.share, group.currency) : "No expenses";
                return (
                  // `bleed-px` matches the header above, keeping each row's
                  // values aligned with its column label.
                  <li
                    key={member.memberId}
                    className={`${grid} relative bleed-px py-3 transition-colors hover:bg-wash has-[button:focus-visible]:bg-wash`}
                  >
                    <button
                      type="button"
                      aria-haspopup="dialog"
                      onClick={() => onMemberClick?.(member.memberId, group.currency)}
                      className="flex min-w-0 items-center gap-3 text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-forest"
                    >
                      <MemberAvatar id={member.memberId} name={member.name} size="sm" />
                      <span className="min-w-0 break-words font-medium">
                        {member.name}
                        {isViewer && <span className="text-ink-soft"> (you)</span>}
                        {hasSpend && (
                          <span className="mt-1 block text-xs font-normal text-ink-soft @min-[29.5rem]:hidden">
                            {member.share ? (
                              <>
                                Spent{" "}
                                <span className="font-numeric font-semibold text-ink">{spent}</span>
                              </>
                            ) : (
                              spent
                            )}
                          </span>
                        )}
                      </span>
                    </button>
                    {hasPaidFor && (
                      <span className="hidden text-right text-ink-soft @min-[29.5rem]:block">
                        {member.paidFor ? (
                          <>
                            <span className="font-numeric">{member.paidFor}</span> expense
                            {member.paidFor === 1 ? "" : "s"}
                          </>
                        ) : (
                          "-"
                        )}
                      </span>
                    )}
                    {hasSpend && (
                      <span className="hidden text-right @min-[29.5rem]:block">
                        {member.share ? (
                          <span className="font-numeric font-semibold text-ink">{spent}</span>
                        ) : (
                          <span className="text-xs text-ink-soft">{spent}</span>
                        )}
                      </span>
                    )}
                    <span className="flex justify-end">
                      <BalanceValue balance={member.balance} code={group.currency} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function ConsolidatedSummaryList({
  data,
  onMemberClick,
}: {
  data: SettlementSummaryData;
  onMemberClick?: (memberId: string, currencyCode: string) => void;
}) {
  const members = new Map<string, { memberId: string; name: string }>();
  for (const group of data.currencies) {
    for (const member of group.members) {
      if (!members.has(member.memberId)) {
        members.set(member.memberId, { memberId: member.memberId, name: member.name });
      }
    }
  }
  const orderedMembers = [...members.values()].sort(
    (a, b) =>
      Number(b.memberId === data.viewerMemberId) - Number(a.memberId === data.viewerMemberId),
  );
  const hasSpend = data.currencies.some((group) =>
    group.members.some((member) => member.share !== undefined),
  );
  const hasPaidFor = data.currencies.some((group) =>
    group.members.some((member) => member.paidFor !== undefined),
  );
  const grid = hasSpend
    ? hasPaidFor
      ? balanceRowGrid.withSpendAndPaidFor
      : balanceRowGrid.withSpend
    : hasPaidFor
      ? balanceRowGrid.withPaidFor
      : balanceRowGrid.balanceOnly;
  const rowsByCurrency = (memberId: string) =>
    data.currencies.flatMap((group) => {
      const member = group.members.find((row) => row.memberId === memberId);
      if (!member || ((member.share ?? 0) === 0 && member.balance === 0)) return [];
      return [{ group, member }];
    });
  return (
    <div className="bleed">
      <div className={`${grid} hidden bleed-px py-2 @min-[29.5rem]:grid`}>
        <span aria-hidden="true" />
        {hasPaidFor && (
          <span className="text-right text-xs font-medium uppercase text-ink-soft">Paid for</span>
        )}
        {hasSpend && (
          <span className="text-right text-xs font-medium uppercase text-ink-soft">Spent</span>
        )}
        <span className="text-right text-xs font-medium uppercase text-ink-soft">Balance</span>
      </div>
      {/* The column labels hide below the container breakpoint, so the top
          rule lives on the body rather than the header row. */}
      <div className="divide-y divide-rule border-y border-edge bg-field">
        {orderedMembers.map((member) => {
          const isViewer = member.memberId === data.viewerMemberId;
          const rows = rowsByCurrency(member.memberId);
          return (
            <div key={member.memberId}>
              <div className={`${grid} bg-surface bleed-px py-3`}>
                <span className="flex min-w-0 items-center gap-3">
                  <MemberAvatar id={member.memberId} name={member.name} size="sm" />
                  <span className="min-w-0 break-words font-medium">
                    {member.name}
                    {isViewer && <span className="text-ink-soft"> (you)</span>}
                  </span>
                </span>
              </div>
              <div className="divide-y divide-rule">
                {rows.map(({ group, member: currencyMember }) => {
                  const spent = currencyMember.share
                    ? currency(currencyMember.share, group.currency)
                    : "No expenses";
                  return (
                    <button
                      key={group.currency}
                      type="button"
                      aria-haspopup="dialog"
                      onClick={() => onMemberClick?.(member.memberId, group.currency)}
                      className={`${grid} relative w-full bleed-px py-3 text-left transition-colors hover:bg-wash focus-visible:outline-none focus-visible:after:absolute focus-visible:after:inset-0 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-forest`}
                    >
                      <span className="min-w-0 break-words text-xs text-ink-soft">
                        <span className="font-numeric font-semibold text-ink">
                          {group.currency}
                        </span>
                        {hasSpend && (
                          <span className="mt-1 block @min-[29.5rem]:hidden">
                            {currencyMember.share ? (
                              <>
                                Spent{" "}
                                <span className="font-numeric font-semibold text-ink">{spent}</span>
                              </>
                            ) : (
                              spent
                            )}
                          </span>
                        )}
                      </span>
                      {hasPaidFor && (
                        <span className="hidden text-right text-ink-soft @min-[29.5rem]:block">
                          {currencyMember.paidFor ? (
                            <>
                              <span className="font-numeric">{currencyMember.paidFor}</span> expense
                              {currencyMember.paidFor === 1 ? "" : "s"}
                            </>
                          ) : (
                            "-"
                          )}
                        </span>
                      )}
                      {hasSpend && (
                        <span className="hidden text-right @min-[29.5rem]:block">
                          {currencyMember.share ? (
                            <span className="font-numeric font-semibold text-ink">{spent}</span>
                          ) : (
                            <span className="text-xs text-ink-soft">{spent}</span>
                          )}
                        </span>
                      )}
                      <span className="flex justify-end">
                        <BalanceValue balance={currencyMember.balance} code={group.currency} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SettlementSummaryList({
  data,
  onMemberClick,
}: {
  data: SettlementSummaryData;
  onMemberClick?: (memberId: string, currencyCode: string) => void;
}) {
  return data.currencies.length > 1 ? (
    <ConsolidatedSummaryList data={data} onMemberClick={onMemberClick} />
  ) : (
    <SingleCurrencySummaryList data={data} onMemberClick={onMemberClick} />
  );
}

export function SettlementSummary({
  data,
  onMemberClick,
}: {
  data: SettlementSummaryData;
  onMemberClick?: (memberId: string, currencyCode: string) => void;
}) {
  return (
    <div className="space-y-2 text-sm" aria-live="polite">
      {data.missingPayers.length > 0 && (
        <p className="text-margin-red-ink">
          Balances incomplete: payer needed for {data.missingPayers.length}{" "}
          {data.missingPayers.length === 1 ? "expense" : "expenses"}.
        </p>
      )}
      {!data.viewerMemberId ? (
        <p className="text-ink-soft">View balances and payments</p>
      ) : data.currencies.length === 0 ? (
        <p className="text-ink-soft">
          {data.missingPayers.length
            ? "Assign payers to calculate what everyone owes."
            : "No outstanding balances."}
        </p>
      ) : (
        <SettlementSummaryList data={data} onMemberClick={onMemberClick} />
      )}
    </div>
  );
}

export function TabSettlement({
  slug,
  members,
  isOwner,
  defaultCurrency = "USD",
  expenses = [],
  expenseView = "paid",
}: {
  slug: string;
  members: Member[];
  isOwner: boolean;
  defaultCurrency?: string;
  expenses?: TabExpenseSummary[];
  expenseView?: ExpenseView;
}) {
  const [day, setDay] = useState(todayISODate);
  const [open, setOpen] = useState(false);
  const [memberBreakdownOpen, setMemberBreakdownOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<{
    memberId: string;
    currency: string;
    name: string;
  } | null>(null);
  const [selectedExpenseSlug, setSelectedExpenseSlug] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentDraft | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentPending, setPaymentPending] = useState(false);
  const [reversingId, setReversingId] = useState<SettlementData["history"][number]["id"] | null>(
    null,
  );
  const [status, setStatus] = useState("");
  const requestId = useRef("");
  const submitting = useRef(false);
  // An already-open client can briefly receive the pre-consolidation response
  // while Convex deploys the updated query. Keep that rollout transition safe.
  const response = useQuery(api.settlements.get, { slug, asOfDate: day }) as
    | SettlementQueryResponse
    | null
    | undefined;
  const breakdown = useTabBreakdown(slug);
  const record = useMutation(api.settlements.record);
  const reverse = useMutation(api.settlements.reverse);

  useEffect(() => {
    const refresh = () => setDay(todayISODate());
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  async function savePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!payment || submitting.current) return;
    const amount = Number(payment.amountText);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError("Enter an amount greater than zero.");
      return;
    }
    const limit = maxPayment(payment);
    if (amount > limit) {
      setPaymentError(
        `${memberName(payment.fromMemberId)} can pay ${memberName(payment.toMemberId)} at most ${currency(limit, payment.currency)}.`,
      );
      return;
    }
    if (!payment.date || payment.date > day) {
      setPaymentError("Choose a payment date on or before today.");
      return;
    }
    submitting.current = true;
    setPaymentPending(true);
    setPaymentError(null);
    try {
      await record({
        slug,
        fromMemberId: payment.fromMemberId,
        toMemberId: payment.toMemberId,
        amount,
        currency: payment.currency,
        date: payment.date,
        note: payment.note.trim() || undefined,
        requestId: requestId.current,
        asOfDate: day,
        view: payment.expenseView,
      });
      setPayment(null);
      setStatus("Payment recorded. Balances updated.");
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Couldn’t record payment.");
    } finally {
      submitting.current = false;
      setPaymentPending(false);
    }
  }

  if (response === undefined)
    return (
      <Panel bleedOnMobile className="@container card-inset" role="region" aria-label="Balances">
        <SectionTitle>Balances</SectionTitle>
        <p role="status" className="mt-2 text-sm text-ink-soft">
          Loading settlement balances…
        </p>
      </Panel>
    );
  if (response === null) return null;

  const data = "paid" in response ? response[expenseView] : response;
  const allData = "paid" in response ? response.all : data;
  const settlementViews = [{ title: null, data, paymentExpenseView: expenseView }];
  const viewLabel = expenseView[0].toUpperCase() + expenseView.slice(1);
  const modalDescription =
    expenseView === "paid"
      ? `Paid expenses through ${formatExpenseDate(day)}. Record transfers already made outside the app.`
      : expenseView === "upcoming"
        ? "Projected balances for upcoming expenses. Record transfers already made toward them."
        : "Paid and upcoming balances. Upcoming amounts are projected. Record transfers already made.";

  const memberName = (id: string) =>
    members.find((member) => member.id === id)?.name ?? "Unknown member";

  // Recording a payment is free-form: pick who paid whom. The server only
  // accepts a payment from someone who owes to someone who is owed, for at
  // most the smaller of their two balances, so the pickers offer exactly those
  // people and the amount defaults to that ceiling.
  const payingParties = (code: string) => {
    const group = data.currencies.find((row) => row.currency === code);
    const byMagnitude = (a: SettlementMember, b: SettlementMember) =>
      Math.abs(b.balance) - Math.abs(a.balance);
    return {
      payers: (group?.members ?? []).filter((member) => member.balance < 0).sort(byMagnitude),
      payees: (group?.members ?? []).filter((member) => member.balance > 0).sort(byMagnitude),
    };
  };
  const payableCurrencies = data.currencies
    .map((group) => group.currency)
    .filter((code) => {
      const { payers, payees } = payingParties(code);
      return payers.length > 0 && payees.length > 0;
    });
  function maxPayment(draft: Pick<PaymentDraft, "currency" | "fromMemberId" | "toMemberId">) {
    const { payers, payees } = payingParties(draft.currency);
    const from = payers.find((member) => member.memberId === draft.fromMemberId);
    const to = payees.find((member) => member.memberId === draft.toMemberId);
    if (!from || !to) return 0;
    return Math.round(Math.min(-from.balance, to.balance) * 100) / 100;
  }
  // Changing the currency picks fresh parties; changing either party keeps the
  // other and resets the amount to the new ceiling.
  function paymentDraft(
    code: string,
    parties: Partial<Pick<PaymentDraft, "fromMemberId" | "toMemberId">> = {},
  ) {
    const { payers, payees } = payingParties(code);
    const fromMemberId = parties.fromMemberId ?? payers[0].memberId;
    const toMemberId = parties.toMemberId ?? payees[0].memberId;
    return {
      currency: code,
      fromMemberId,
      toMemberId,
      amountText: String(maxPayment({ currency: code, fromMemberId, toMemberId })),
    };
  }
  function beginPayment() {
    const code = payableCurrencies.includes(defaultCurrency)
      ? defaultCurrency
      : payableCurrencies[0];
    if (!code) return;
    requestId.current = crypto.randomUUID();
    setPaymentError(null);
    setPayment({ ...paymentDraft(code), expenseView, date: day, note: "" });
  }
  const reverseHistory = allData.history.find((item) => item.id === reversingId);
  const selectedBreakdown = selectedMember
    ? breakdown?.currencies
        .find((group) => group.currency === selectedMember.currency)
        ?.members.find((member) => member.memberId === selectedMember.memberId)
    : undefined;
  const selectedExpense = expenses.find((expense) => expense.slug === selectedExpenseSlug);
  return (
    <Panel bleedOnMobile className="@container card-inset" role="region" aria-label="Balances">
      <Dialog open={open} onOpenChange={setOpen}>
        {/* View payments is `secondary` and Breakdown stays a link (DESIGN.md
            § 5). On a phone, Breakdown shares the title row while the wider
            View payments action takes the row below. */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SectionTitle className="flex items-center gap-2">
            <Scale aria-hidden="true" className="h-5 w-5 text-brass" strokeWidth={2.25} />
            Balances
          </SectionTitle>
          {data.currencies.length > 0 && (
            <Link
              to="/t/$slug/breakdown"
              params={{ slug }}
              className="group ml-auto inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md text-sm font-medium text-forest hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest sm:hidden"
            >
              Breakdown <ChevronRight aria-hidden="true" className="h-4 w-4 chevron-x" />
            </Link>
          )}
          <div className="ml-auto flex w-full items-center gap-3 sm:w-auto">
            <DialogTrigger
              render={<Button variant="secondary" size="touch" className="w-full sm:w-auto" />}
            >
              View payments
            </DialogTrigger>
            {data.currencies.length > 0 && (
              <Link
                to="/t/$slug/breakdown"
                params={{ slug }}
                className="group hidden min-h-11 shrink-0 items-center gap-1 rounded-md text-sm font-medium text-forest hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest sm:inline-flex"
              >
                Breakdown <ChevronRight aria-hidden="true" className="h-4 w-4 chevron-x" />
              </Link>
            )}
          </div>
        </div>
        <SettlementSummary
          data={data}
          onMemberClick={(memberId, currencyCode) => {
            const member = data.currencies
              .find((group) => group.currency === currencyCode)
              ?.members.find((row) => row.memberId === memberId);
            if (member) {
              setSelectedMember({ memberId, currency: currencyCode, name: member.name });
              setMemberBreakdownOpen(true);
            }
          }}
        />
        <DialogContent className="flex max-h-[calc(100dvh-5rem)] max-w-2xl flex-col overflow-hidden p-0 sm:p-0">
          <header className="sticky top-0 z-10 shrink-0 border-b border-rule/70 bg-surface p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle>Settle up ({viewLabel})</DialogTitle>
                <DialogDescription className="mt-1">{modalDescription}</DialogDescription>
              </div>
              <DialogClose
                aria-label="Close settlement"
                render={<Button variant="ghost" size="icon-touch" />}
              >
                <X aria-hidden="true" />
              </DialogClose>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
            <div className="space-y-6">
              {settlementViews.map(({ title, data: viewData, paymentExpenseView }) => (
                <section key={paymentExpenseView} aria-label={title ?? "Settlement balances"}>
                  {title && <GroupTitle as="h3">{title}</GroupTitle>}
                  {viewData.missingPayers.length > 0 && (
                    <div className="mt-3 rounded-md border border-rule bg-field p-3 text-sm">
                      <p className="text-margin-red-ink">
                        These expenses are excluded until a payer is assigned:
                      </p>
                      <ul className="mt-2 space-y-1">
                        {viewData.missingPayers.map((expense) => (
                          <li key={expense.slug} className="break-words">
                            {isOwner ? (
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
                  {viewData.currencies.length === 0 ? (
                    <p className="mt-3 text-sm text-ink-soft">
                      {viewData.missingPayers.length
                        ? "Assign payers to see balances."
                        : "No outstanding balances."}
                    </p>
                  ) : (
                    <div className="mt-3 space-y-5">
                      {viewData.currencies.map((group) => (
                        <section key={group.currency} aria-label={`${group.currency} balances`}>
                          <GroupTitle as="h3">{group.currency}</GroupTitle>
                          <ul className="mt-3 divide-y divide-rule rounded-lg border border-edge bg-field">
                            {group.members.map((member) => (
                              <li
                                key={member.memberId}
                                className="flex flex-wrap justify-between gap-3 px-3 py-3 text-sm"
                              >
                                <span className="min-w-0 break-words">{member.name}</span>
                                <BalanceValue balance={member.balance} code={group.currency} />
                              </li>
                            ))}
                          </ul>
                        </section>
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </div>
            {/* The dialog's own `default` (DESIGN.md § 5: a dialog is its own
                region). Only shown when someone in this view owes someone. */}
            {isOwner && payableCurrencies.length > 0 && (
              <div className="mt-5 flex justify-end">
                <Button size="touch" className="w-full sm:w-auto" onClick={beginPayment}>
                  <Banknote aria-hidden="true" className="h-4 w-4" />
                  Record payment
                </Button>
              </div>
            )}
            <section className="mt-5 border-t border-rule pt-4">
              <GroupTitle as="h3">Payment history</GroupTitle>
              {!allData.history.length && (
                <p className="mt-2 text-sm text-ink-soft">No payments recorded yet.</p>
              )}
              <ul className="mt-2 space-y-3">
                {allData.history.map((item) => (
                  <li
                    key={item.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-1">
                      <div className="min-w-0 flex-1 break-words">
                        <p>
                          {memberName(item.fromMemberId)} → {memberName(item.toMemberId)}
                        </p>
                        <p className="text-xs text-ink-soft">
                          {formatExpenseDate(item.date)} · {item.currency}
                          {item.reversed ? " · Reversed" : ""}
                        </p>
                        {item.note && (
                          <p className="mt-1 whitespace-pre-wrap text-xs text-ink-soft">
                            {item.note}
                          </p>
                        )}
                      </div>
                      {isOwner && !item.reversed && (
                        <Button
                          variant="destructive-icon"
                          size="icon-lg"
                          title="Reverse payment"
                          aria-label={`Reverse ${currency(item.amount, item.currency)} payment from ${memberName(item.fromMemberId)} to ${memberName(item.toMemberId)}`}
                          onClick={() => setReversingId(item.id)}
                        >
                          <RotateCcw aria-hidden="true" className="h-4 w-4" strokeWidth={2.25} />
                        </Button>
                      )}
                    </div>
                    <span className="font-numeric whitespace-nowrap">
                      {currency(item.amount, item.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={memberBreakdownOpen}
        onOpenChange={(next) => {
          setMemberBreakdownOpen(next);
        }}
      >
        <DialogContent className="flex max-h-[calc(100dvh-5rem)] max-w-2xl flex-col overflow-hidden p-0 sm:p-0">
          <header className="shrink-0 border-b border-rule/70 bg-surface p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-3">
                  {selectedBreakdown && selectedMember && (
                    <MemberAvatar
                      id={selectedBreakdown.memberId}
                      name={selectedBreakdown.name}
                      size="sm"
                    />
                  )}
                  <div className="min-w-0">
                    <DialogTitle className="sr-only">
                      {selectedMember?.name ?? "Member breakdown"}
                    </DialogTitle>
                    <p className="break-words text-sm font-medium text-ink">
                      {selectedMember?.name ?? "Member breakdown"}
                    </p>
                    <DialogDescription className="mt-1 text-xs">
                      {selectedBreakdown
                        ? `${selectedBreakdown.expenseCount} ${selectedBreakdown.expenseCount === 1 ? "expense" : "expenses"} · ${selectedMember?.currency}`
                        : `${selectedMember?.currency ?? ""} expense breakdown`}
                    </DialogDescription>
                  </div>
                </div>
              </div>
              <DialogClose
                aria-label="Close member breakdown"
                render={<Button variant="ghost" size="icon-touch" className="text-ink-soft" />}
              >
                <X aria-hidden="true" />
              </DialogClose>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto card-inset">
            {breakdown === undefined ? (
              <p role="status" className="text-sm text-ink-soft">
                Loading breakdown…
              </p>
            ) : selectedBreakdown && selectedMember ? (
              <TabMemberBreakdown
                member={selectedBreakdown}
                currencyCode={selectedMember.currency}
                variant="modal"
                onExpenseClick={(expenseSlug) => {
                  setMemberBreakdownOpen(false);
                  setSelectedExpenseSlug(expenseSlug);
                }}
              />
            ) : (
              <p className="text-sm text-ink-soft">No breakdown available.</p>
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
        isOwner={isOwner}
        members={members}
      />
      <ConfirmDialog
        open={reversingId !== null}
        onOpenChange={(next) => {
          if (!next) setReversingId(null);
        }}
        title="Reverse this payment?"
        description={
          reverseHistory
            ? `${memberName(reverseHistory.fromMemberId)}’s ${currency(reverseHistory.amount, reverseHistory.currency)} payment to ${memberName(reverseHistory.toMemberId)} will be reversed. The history entry stays visible and balances are recalculated.`
            : "This payment will be reversed."
        }
        confirmLabel="Reverse payment"
        pendingLabel="Reversing…"
        onConfirm={async () => {
          if (reversingId) {
            await reverse({ slug, settlementId: reversingId });
            setStatus("Payment reversed. Balances updated.");
          }
        }}
      />
      {payment && (
        <Dialog
          open
          onOpenChange={(next) => {
            if (!next && !submitting.current) {
              setPayment(null);
              setPaymentError(null);
            }
          }}
        >
          <DialogContent>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription className="mt-1">
              This records money already transferred outside the app.
            </DialogDescription>
            <form onSubmit={savePayment} className="mt-5 space-y-4" aria-busy={paymentPending}>
              <fieldset disabled={paymentPending} className="space-y-4">
                {payableCurrencies.length > 1 && (
                  <div>
                    <Label htmlFor="settlement-currency">Currency</Label>
                    <Select
                      id="settlement-currency"
                      className="w-full font-numeric"
                      value={payment.currency}
                      onChange={(event) =>
                        setPayment({ ...payment, ...paymentDraft(event.target.value) })
                      }
                    >
                      {payableCurrencies.map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="settlement-from">From</Label>
                    <Select
                      id="settlement-from"
                      className="w-full"
                      value={payment.fromMemberId}
                      onChange={(event) =>
                        setPayment({
                          ...payment,
                          ...paymentDraft(payment.currency, {
                            fromMemberId: event.target.value as PaymentDraft["fromMemberId"],
                            toMemberId: payment.toMemberId,
                          }),
                        })
                      }
                    >
                      {payingParties(payment.currency).payers.map((member) => (
                        <option key={member.memberId} value={member.memberId}>
                          {member.name} · owes {currency(-member.balance, payment.currency)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="settlement-to">To</Label>
                    <Select
                      id="settlement-to"
                      className="w-full"
                      value={payment.toMemberId}
                      onChange={(event) =>
                        setPayment({
                          ...payment,
                          ...paymentDraft(payment.currency, {
                            fromMemberId: payment.fromMemberId,
                            toMemberId: event.target.value as PaymentDraft["toMemberId"],
                          }),
                        })
                      }
                    >
                      {payingParties(payment.currency).payees.map((member) => (
                        <option key={member.memberId} value={member.memberId}>
                          {member.name} · gets {currency(member.balance, payment.currency)}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="settlement-amount">Amount ({payment.currency})</Label>
                  <Input
                    id="settlement-amount"
                    icon={Banknote}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0.01"
                    className="font-numeric"
                    value={payment.amountText}
                    onChange={(event) => setPayment({ ...payment, amountText: event.target.value })}
                    aria-invalid={!!paymentError}
                    aria-describedby={paymentError ? "settlement-error" : "settlement-amount-help"}
                    required
                  />
                  <p id="settlement-amount-help" className="mt-1 text-xs text-ink-soft">
                    Up to {currency(maxPayment(payment), payment.currency)}. You can record a
                    partial payment.
                  </p>
                </div>
                <div>
                  <Label htmlFor="settlement-date">Payment date</Label>
                  <DatePicker
                    id="settlement-date"
                    className="w-full"
                    value={payment.date}
                    onChange={(date) => setPayment({ ...payment, date })}
                    aria-label="Payment date"
                  />
                </div>
                <div>
                  <Label htmlFor="settlement-note">Note (optional)</Label>
                  <Textarea
                    id="settlement-note"
                    maxLength={2000}
                    value={payment.note}
                    onChange={(event) => setPayment({ ...payment, note: event.target.value })}
                  />
                </div>
              </fieldset>
              {paymentError && <FieldError id="settlement-error">{paymentError}</FieldError>}
              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="touch"
                  disabled={paymentPending}
                  onClick={() => {
                    setPayment(null);
                    setPaymentError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="touch"
                  disabled={paymentPending}
                  aria-busy={paymentPending}
                >
                  {paymentPending ? "Recording…" : "Record payment"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
      {status && (
        <p className="mt-2 text-xs text-ink-soft" role="status">
          {status}
        </p>
      )}
    </Panel>
  );
}
