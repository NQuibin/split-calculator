import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Check, X } from "lucide-react";

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
import { useLocaleFormatters } from "@/lib/localeFormatters";
import { useTabBreakdown, type TabExpenseSummary } from "@/lib/tabSync";
import type { ExpenseView } from "@/components/ExpenseViewTabs";

type Member = { id: string; name: string };
type SettlementResponse = NonNullable<FunctionReturnType<typeof api.settlements.get>>;
type SettlementQueryResponse = SettlementResponse | SettlementResponse["paid"];
export type SettlementSummaryData = {
  viewerMemberId: string | null;
  missingPayers: { slug: string; name: string }[];
  currencies: {
    currency: string;
    members: {
      memberId: string;
      name: string;
      balance: number;
      /** Positive means this member owes the viewer; negative means the viewer owes them. */
      balanceWithViewer?: number;
      hasSharedExpenseWithViewer?: boolean;
      includedIn?: number;
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
    const participated = (id: string) =>
      expense.payerId === id || expense.items.some((item) => item.splitWith.includes(id));
    return participated(viewerMemberId) && participated(memberId);
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
      ) : data.currencies.length === 0 ? (
        <p className="text-ink-soft">
          {data.missingPayers.length
            ? "Assign payers to calculate what everyone owes."
            : "No outstanding balances."}
        </p>
      ) : (
        <>
          <div className="flex min-w-0 items-center gap-3 border-b border-rule bleed bleed-px pb-4">
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
          {data.currencies.map((group) => {
            const members = group.members.filter(
              (member) =>
                member.memberId !== data.viewerMemberId &&
                (member.hasSharedExpenseWithViewer !== false || memberDirectBalance(member) !== 0),
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
                <div className="flex min-h-11 flex-wrap items-center justify-between gap-3 border-b border-rule bleed-px py-2">
                  <span className="rounded-full border border-rule bg-chip-neutral px-3 py-1 font-numeric text-xs font-semibold text-ink">
                    {group.currency}
                  </span>
                  <div className="flex gap-4 sm:gap-6">
                    <p className="flex flex-col text-right sm:flex-row sm:items-center sm:gap-3">
                      <span className="text-sm text-ink-soft">You are owed</span>
                      <span className="font-numeric font-semibold text-ledger-green">
                        {currency(owedCents / 100, group.currency)}
                      </span>
                    </p>
                    <p className="flex flex-col text-right sm:flex-row sm:items-center sm:gap-3">
                      <span className="text-sm text-ink-soft">You owe</span>
                      <span className="font-numeric font-semibold text-margin-red-ink">
                        {currency(oweCents / 100, group.currency)}
                      </span>
                    </p>
                  </div>
                </div>
                <ul className="divide-y divide-rule border-y border-edge bg-field">
                  {members.length === 0 && (
                    <li className="bleed-px py-3 text-sm text-ink-soft">
                      No shared expenses with other members.
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
                          className="flex min-h-16 w-full min-w-0 items-center justify-between gap-3 bleed-px py-3 text-left transition-colors hover:bg-wash focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-forest"
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <MemberAvatar id={member.memberId} name={member.name} size="md" />
                            <span className="min-w-0 break-words">
                              <span className="block font-medium text-ink">
                                {balance > 0 ? (
                                  <>{member.name} owes you </>
                                ) : balance < 0 ? (
                                  <>You owe {member.name} </>
                                ) : (
                                  <>Settled with {member.name}</>
                                )}
                                {balance !== 0 && (
                                  <span
                                    className={`font-numeric ${balance > 0 ? "text-ledger-green" : "text-margin-red-ink"}`}
                                  >
                                    {currency(Math.abs(balance), group.currency)}
                                  </span>
                                )}
                                {balance === 0 && (
                                  <Check
                                    aria-label="Settled"
                                    className="ml-1 inline h-5 w-5 text-ledger-green"
                                    strokeWidth={2.25}
                                  />
                                )}
                              </span>
                              <span className="mt-1 block text-xs text-ink-soft">
                                {expenseCount} {expenseCount === 1 ? "expense" : "expenses"}
                              </span>
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
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
                      ? `${selectedBreakdown.expenses.filter((line) => line.sharedWithViewer).length} ${selectedBreakdown.expenses.filter((line) => line.sharedWithViewer).length === 1 ? "expense" : "expenses"} · ${selectedMember?.currency}`
                      : `${selectedMember?.currency ?? ""} expenses`}
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
              <TabMemberBreakdown
                member={selectedBreakdown}
                currencyCode={selectedMember.currency}
                onExpenseClick={(expenseSlug) => {
                  setMemberBreakdownOpen(false);
                  setSelectedExpenseSlug(expenseSlug);
                }}
              />
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
