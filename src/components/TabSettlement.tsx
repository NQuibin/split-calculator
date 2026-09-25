import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Banknote, Check, ChevronRight, CircleMinus, RotateCcw, Scale, X } from "lucide-react";

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
import { TabMemberBreakdown, type TabMemberSettlement } from "@/components/TabMemberBreakdown";
import { ExpenseDetailsDialog } from "@/components/ExpenseDetailsDialog";
import { Panel } from "@/components/ui/Page";
import { GroupTitle, SectionTitle } from "@/components/ui/Typography";
import { todayISODate } from "@/lib/format";
import { useLocaleFormatters } from "@/lib/localeFormatters";
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
      /** Direct net balance with the logged-in member; positive means they owe the viewer. */
      balanceWithViewer?: number;
      hasSharedExpenseWithViewer?: boolean;
      share?: number;
      paidFor?: number;
      includedIn?: number;
    }[];
    suggestions?: {
      fromMemberId: string;
      toMemberId: string;
      amount: number;
    }[];
  }[];
};

function balanceColor(balance: number) {
  return balance > 0 ? "text-ledger-green" : balance < 0 ? "text-margin-red-ink" : "text-ink";
}

type BalanceDirection = "you-get" | "you-owe" | "owes-you" | "gets" | "owes";

type BalanceDisplay = {
  balance: number;
  direction: BalanceDirection | null;
};

function balanceDirection({
  balance,
  memberId,
  viewerMemberId,
  suggestions,
}: {
  balance: number;
  memberId?: string;
  viewerMemberId?: string | null;
  suggestions?: SettlementSummaryData["currencies"][number]["suggestions"];
}): BalanceDirection | null {
  if (balance === 0) return null;
  if (memberId && memberId === viewerMemberId) return balance > 0 ? "you-get" : "you-owe";
  const directSuggestion = suggestions?.find(
    (suggestion) =>
      (suggestion.fromMemberId === memberId && suggestion.toMemberId === viewerMemberId) ||
      (suggestion.fromMemberId === viewerMemberId && suggestion.toMemberId === memberId),
  );
  if (directSuggestion) {
    return directSuggestion.fromMemberId === memberId ? "owes-you" : "you-owe";
  }
  return balance > 0 ? "gets" : "owes";
}

function balanceDisplay({
  balance,
  balanceWithViewer,
  memberId,
  viewerMemberId,
  suggestions,
}: {
  balance: number;
  balanceWithViewer?: number;
  memberId?: string;
  viewerMemberId?: string | null;
  suggestions?: SettlementSummaryData["currencies"][number]["suggestions"];
}): BalanceDisplay {
  // The viewer's row is the only aggregate balance. Every other row is about
  // the direct relationship with the viewer, so unrelated settlement edges
  // must not leak into its amount or direction.
  if (!memberId || memberId === viewerMemberId || !viewerMemberId) {
    return {
      balance,
      direction: balanceDirection({ balance, memberId, viewerMemberId, suggestions }),
    };
  }

  // The consolidated response provides the exact direct relationship. Keep
  // the suggestion fallback below for clients during the rolling deployment.
  if (balanceWithViewer !== undefined) {
    return {
      balance: balanceWithViewer,
      direction: balanceWithViewer > 0 ? "owes-you" : balanceWithViewer < 0 ? "you-owe" : null,
    };
  }

  const directSuggestion = suggestions?.find(
    (suggestion) =>
      (suggestion.fromMemberId === memberId && suggestion.toMemberId === viewerMemberId) ||
      (suggestion.fromMemberId === viewerMemberId && suggestion.toMemberId === memberId),
  );
  if (!directSuggestion || directSuggestion.amount === 0) {
    return { balance: 0, direction: null };
  }

  const owesViewer = directSuggestion.fromMemberId === memberId;
  return {
    balance: owesViewer ? directSuggestion.amount : -directSuggestion.amount,
    direction: owesViewer ? "owes-you" : "you-owe",
  };
}

function directionLabel(direction: BalanceDirection | null) {
  switch (direction) {
    case "you-get":
      return "You get";
    case "you-owe":
      return "You owe";
    case "owes-you":
      return "Owes you";
    case "gets":
      return "Gets";
    case "owes":
      return "Owes";
    default:
      return "Settled";
  }
}

function SettledBalance() {
  return (
    <span className="inline-flex w-20 shrink-0 items-center justify-end gap-1.5 text-ledger-green">
      <span className="text-xs font-normal text-ink-soft">Settled</span>
      <Check aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
    </span>
  );
}

function NoBalance() {
  return (
    <span className="inline-flex w-20 shrink-0 items-center justify-end gap-1.5 text-ink-soft">
      <span className="text-xs font-normal">None</span>
      <CircleMinus aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
    </span>
  );
}

function BalanceLabel({
  balance,
  balanceWithViewer,
  hasSharedExpenseWithViewer,
  code,
  memberId,
  viewerMemberId,
  suggestions,
}: {
  balance: number;
  balanceWithViewer?: number;
  hasSharedExpenseWithViewer?: boolean;
  code: string;
  memberId?: string;
  viewerMemberId?: string | null;
  suggestions?: SettlementSummaryData["currencies"][number]["suggestions"];
}) {
  const { currency } = useLocaleFormatters();
  const display = balanceDisplay({
    balance,
    balanceWithViewer,
    memberId,
    viewerMemberId,
    suggestions,
  });
  if (hasSharedExpenseWithViewer === false && memberId !== viewerMemberId) return <NoBalance />;
  if (display.balance === 0 && memberId !== viewerMemberId) return <SettledBalance />;
  return (
    <span className={`${balanceColor(display.balance)} break-words`}>
      {directionLabel(display.direction)}{" "}
      {display.balance !== 0 && (
        <span className="font-numeric">{currency(Math.abs(display.balance), code)}</span>
      )}
    </span>
  );
}

function BalanceValue({
  balance,
  balanceWithViewer,
  hasSharedExpenseWithViewer,
  code,
  memberId,
  viewerMemberId,
  suggestions,
}: {
  balance: number;
  balanceWithViewer?: number;
  hasSharedExpenseWithViewer?: boolean;
  code: string;
  memberId?: string;
  viewerMemberId?: string | null;
  suggestions?: SettlementSummaryData["currencies"][number]["suggestions"];
}) {
  return (
    <span className="inline-flex flex-wrap items-center font-semibold">
      <BalanceLabel
        balance={balance}
        balanceWithViewer={balanceWithViewer}
        hasSharedExpenseWithViewer={hasSharedExpenseWithViewer}
        code={code}
        memberId={memberId}
        viewerMemberId={viewerMemberId}
        suggestions={suggestions}
      />
    </span>
  );
}

function MobileBalanceValue({
  balance,
  balanceWithViewer,
  hasSharedExpenseWithViewer,
  code,
  spent,
  memberId,
  viewerMemberId,
  suggestions,
}: {
  balance: number;
  balanceWithViewer?: number;
  hasSharedExpenseWithViewer?: boolean;
  code: string;
  spent?: string;
  memberId?: string;
  viewerMemberId?: string | null;
  suggestions?: SettlementSummaryData["currencies"][number]["suggestions"];
}) {
  const { currency } = useLocaleFormatters();
  const display = balanceDisplay({
    balance,
    balanceWithViewer,
    memberId,
    viewerMemberId,
    suggestions,
  });
  const signedBalance =
    display.balance > 0
      ? `+${currency(display.balance, code)}`
      : display.balance < 0
        ? `-${currency(Math.abs(display.balance), code)}`
        : "-";

  return (
    <span className="flex min-w-0 max-w-full flex-col items-end break-words text-right">
      {spent !== undefined && (
        <>
          <span className="text-xs text-ink-soft">Spent</span>
          <span className="break-words font-numeric text-sm font-semibold text-ink">{spent}</span>
        </>
      )}
      {hasSharedExpenseWithViewer === false && memberId !== viewerMemberId ? (
        <span className={spent !== undefined ? "mt-2" : undefined}>
          <NoBalance />
        </span>
      ) : display.balance === 0 ? (
        <span className={spent !== undefined ? "mt-2" : undefined}>
          <SettledBalance />
        </span>
      ) : (
        <>
          <span className={`${spent !== undefined ? "mt-2" : ""} text-xs text-ink-soft`}>
            {directionLabel(display.direction)}
          </span>
          <span className={`${balanceColor(display.balance)} font-numeric text-sm font-semibold`}>
            {signedBalance}
          </span>
        </>
      )}
    </span>
  );
}

function MobileMemberCounts({
  includedIn = 0,
  paidFor = 0,
}: {
  includedIn?: number;
  paidFor?: number;
}) {
  return (
    <span className="col-start-1 row-start-2 self-end text-xs font-normal text-ink-soft @min-[38rem]:hidden">
      <span>
        Included in {includedIn} expense{includedIn === 1 ? "" : "s"}
      </span>
      <span className="block">
        Paid for {paidFor} expense{paidFor === 1 ? "" : "s"}
      </span>
    </span>
  );
}

const viewerCurrencyRowGrid = {
  withSpendAndIncludedInAndPaidFor:
    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 @min-[38rem]:grid-cols-[minmax(0,.65fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)] @min-[38rem]:gap-x-3",
  withSpendAndPaidFor:
    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 @min-[38rem]:grid-cols-[minmax(0,.65fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)] @min-[38rem]:gap-x-3",
  withSpendAndIncludedIn:
    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 @min-[38rem]:grid-cols-[minmax(0,.65fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)] @min-[38rem]:gap-x-3",
  withSpend:
    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 @min-[38rem]:grid-cols-[minmax(0,.65fr)_minmax(0,1fr)_minmax(0,1.5fr)] @min-[38rem]:gap-x-3",
  withIncludedInAndPaidFor:
    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 @min-[38rem]:grid-cols-[minmax(0,.65fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)] @min-[38rem]:gap-x-3",
  withPaidFor:
    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 @min-[38rem]:grid-cols-[minmax(0,.65fr)_minmax(0,1fr)_minmax(0,1.5fr)] @min-[38rem]:gap-x-3",
  withIncludedIn:
    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 @min-[38rem]:grid-cols-[minmax(0,.65fr)_minmax(0,1fr)_minmax(0,1.5fr)] @min-[38rem]:gap-x-3",
  balanceOnly:
    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 @min-[38rem]:grid-cols-[minmax(0,.65fr)_minmax(0,1.5fr)] @min-[38rem]:gap-x-3",
} as const;

type ViewerCurrencyRowGrid = keyof typeof viewerCurrencyRowGrid;

function viewerCurrencyRowGridFor({
  hasSpend,
  hasPaidFor,
  hasIncludedIn,
}: {
  hasSpend: boolean;
  hasPaidFor: boolean;
  hasIncludedIn: boolean;
}): ViewerCurrencyRowGrid {
  if (hasSpend) {
    if (hasIncludedIn) {
      return hasPaidFor ? "withSpendAndIncludedInAndPaidFor" : "withSpendAndIncludedIn";
    }
    return hasPaidFor ? "withSpendAndPaidFor" : "withSpend";
  }
  if (hasIncludedIn) return hasPaidFor ? "withIncludedInAndPaidFor" : "withIncludedIn";
  return hasPaidFor ? "withPaidFor" : "balanceOnly";
}

function MemberCurrencyRow({
  group,
  member,
  hasSpend,
  hasPaidFor,
  hasIncludedIn,
  viewerMemberId,
  onClick,
}: {
  group: SettlementSummaryData["currencies"][number];
  member: SettlementSummaryData["currencies"][number]["members"][number];
  hasSpend: boolean;
  hasPaidFor: boolean;
  hasIncludedIn: boolean;
  viewerMemberId: string;
  onClick?: () => void;
}) {
  const { currency } = useLocaleFormatters();
  const spent = member.share ? currency(member.share, group.currency) : "No expenses";
  const grid =
    viewerCurrencyRowGrid[
      viewerCurrencyRowGridFor({
        hasSpend,
        hasPaidFor,
        hasIncludedIn,
      })
    ];

  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={`View ${member.name}'s ${group.currency} balance breakdown`}
      onClick={onClick}
      className={`${grid} box-border min-h-11 min-w-0 w-full bg-field px-5 py-3 text-left text-sm transition-colors hover:bg-wash focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-forest @max-[37.99rem]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @min-[38rem]:px-6`}
    >
      <span className="min-w-0 break-words text-sm">
        <span className="font-numeric font-semibold text-ink">{group.currency}</span>
      </span>
      {(hasIncludedIn || hasPaidFor) && (
        <span className="col-start-1 row-start-2 flex min-w-0 flex-col gap-y-1 text-xs text-ink-soft @min-[38rem]:contents @min-[38rem]:text-sm">
          {hasIncludedIn && (
            <span className="break-words">
              <span className="@min-[38rem]:hidden">Included in </span>
              <span className="font-numeric">{member.includedIn ?? 0}</span> expense
              {(member.includedIn ?? 0) === 1 ? "" : "s"}
            </span>
          )}
          {hasPaidFor && (
            <span className="break-words">
              <span className="@min-[38rem]:hidden">Paid for </span>
              <span className="font-numeric">{member.paidFor ?? 0}</span> expense
              {(member.paidFor ?? 0) === 1 ? "" : "s"}
            </span>
          )}
        </span>
      )}
      {hasSpend && (
        <span className="hidden min-w-0 break-words text-right font-numeric font-semibold text-ink @min-[38rem]:block">
          {spent}
        </span>
      )}
      <span className="col-start-2 row-span-2 row-start-1 flex min-w-0 justify-end @min-[38rem]:hidden">
        <MobileBalanceValue
          balance={member.balance}
          balanceWithViewer={member.balanceWithViewer}
          hasSharedExpenseWithViewer={member.hasSharedExpenseWithViewer}
          code={group.currency}
          spent={hasSpend ? (member.share ? spent : "-") : undefined}
          memberId={member.memberId}
          viewerMemberId={viewerMemberId}
          suggestions={group.suggestions}
        />
      </span>
      <span className="hidden min-w-0 break-words justify-self-end text-right font-semibold @min-[38rem]:block @max-[44rem]:[&_.font-numeric]:block">
        <BalanceLabel
          balance={member.balance}
          balanceWithViewer={member.balanceWithViewer}
          hasSharedExpenseWithViewer={member.hasSharedExpenseWithViewer}
          code={group.currency}
          memberId={member.memberId}
          viewerMemberId={viewerMemberId}
          suggestions={group.suggestions}
        />
      </span>
    </button>
  );
}

function MultiCurrencyMemberBalanceCard({
  groups,
  memberId,
  viewerMemberId,
  onMemberClick,
  isViewer = false,
}: {
  groups: SettlementSummaryData["currencies"];
  memberId: string;
  viewerMemberId: string;
  onMemberClick?: (memberId: string, currencyCode: string) => void;
  isViewer?: boolean;
}) {
  const member = groups[0]?.members.find((candidate) => candidate.memberId === memberId);
  if (!member) return null;
  const hasSpend = groups.some((group) =>
    group.members.some((member) => member.share !== undefined),
  );
  const hasPaidFor = groups.some((group) =>
    group.members.some((member) => member.paidFor !== undefined),
  );
  const hasIncludedIn = groups.some((group) =>
    group.members.some((member) => member.includedIn !== undefined),
  );
  return (
    <section aria-label={`${member.name} balances`}>
      <div className={`overflow-hidden rounded-none ${isViewer ? "border-y-2 border-forest" : ""}`}>
        <div className="grid min-w-0 @min-[38rem]:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
          <div className="flex min-w-0 items-center gap-3 border-b border-rule px-5 py-4 @min-[38rem]:row-span-full @min-[38rem]:border-b-0 @min-[38rem]:border-r @min-[38rem]:px-6">
            <MemberAvatar
              id={member.memberId}
              name={member.name}
              size="md"
              className={isViewer ? "text-sm" : undefined}
            />
            <span className="min-w-0 break-words">
              {isViewer && <span className="block text-xs font-normal text-ink-soft">You</span>}
              <span
                className={
                  isViewer
                    ? "block min-w-0 break-words text-sm font-semibold text-ink"
                    : "block text-sm font-medium text-ink"
                }
              >
                {member.name}
              </span>
            </span>
          </div>
          <div className="@min-[38rem]:col-start-2">
            <div className="divide-y divide-rule">
              {groups.map((group) => {
                const groupMember = group.members.find(
                  (candidate) => candidate.memberId === memberId,
                );
                if (!groupMember) return null;
                return (
                  <MemberCurrencyRow
                    key={group.currency}
                    group={group}
                    member={groupMember}
                    hasSpend={hasSpend}
                    hasPaidFor={hasPaidFor}
                    hasIncludedIn={hasIncludedIn}
                    viewerMemberId={viewerMemberId}
                    onClick={() => onMemberClick?.(memberId, group.currency)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ViewerBalanceCards({
  data,
  onMemberClick,
  bleed = false,
}: {
  data: SettlementSummaryData;
  onMemberClick?: (memberId: string, currencyCode: string) => void;
  bleed?: boolean;
}) {
  if (!data.viewerMemberId) return null;

  const groups = data.currencies.filter((group) =>
    group.members.some((member) => member.memberId === data.viewerMemberId),
  );

  if (data.currencies.length > 1) {
    const hasSpend = groups.some((group) =>
      group.members.some((member) => member.share !== undefined),
    );
    const hasPaidFor = groups.some((group) =>
      group.members.some((member) => member.paidFor !== undefined),
    );
    const hasIncludedIn = groups.some((group) =>
      group.members.some((member) => member.includedIn !== undefined),
    );
    const grid =
      viewerCurrencyRowGrid[viewerCurrencyRowGridFor({ hasSpend, hasPaidFor, hasIncludedIn })];
    return (
      <div className={bleed ? "bleed mb-0 [&>*]:mx-0" : undefined}>
        <div>
          <div className="hidden border-y border-rule bg-surface @min-[38rem]:grid @min-[38rem]:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
            <span aria-hidden="true" />
            <div
              className={`${grid} box-border w-full px-6 py-2 text-xs font-medium uppercase text-ink-soft`}
            >
              <span aria-hidden="true" />
              {hasIncludedIn && <span>Included in</span>}
              {hasPaidFor && <span>Paid for</span>}
              {hasSpend && <span className="text-right">Spent</span>}
              <span className="text-right">Balance</span>
            </div>
          </div>
          <MultiCurrencyMemberBalanceCard
            groups={groups}
            memberId={data.viewerMemberId}
            viewerMemberId={data.viewerMemberId}
            onMemberClick={onMemberClick}
            isViewer
          />
        </div>
      </div>
    );
  }

  return null;
}

const balanceRowGrid = {
  withSpend:
    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 @min-[38rem]:grid-cols-[minmax(0,1fr)_7rem_9.5rem] @min-[38rem]:gap-x-4",
  withSpendAndPaidFor:
    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 @min-[38rem]:grid-cols-[minmax(0,1fr)_5rem_7rem_9.5rem] @min-[38rem]:gap-x-4",
  withSpendAndIncludedIn:
    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 @min-[38rem]:grid-cols-[minmax(0,1fr)_6rem_7rem_9.5rem] @min-[38rem]:gap-x-4",
  withSpendAndIncludedInAndPaidFor:
    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 @min-[38rem]:grid-cols-[minmax(0,1fr)_6rem_5rem_7rem_9.5rem] @min-[38rem]:gap-x-4",
  withPaidFor:
    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 @min-[38rem]:grid-cols-[minmax(0,1fr)_5rem_9.5rem] @min-[38rem]:gap-x-4",
  withIncludedIn:
    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 @min-[38rem]:grid-cols-[minmax(0,1fr)_6rem_9.5rem] @min-[38rem]:gap-x-4",
  withIncludedInAndPaidFor:
    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 @min-[38rem]:grid-cols-[minmax(0,1fr)_6rem_5rem_9.5rem] @min-[38rem]:gap-x-4",
  balanceOnly:
    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 @min-[38rem]:grid-cols-[minmax(0,1fr)_9.5rem] @min-[38rem]:gap-x-4",
} as const;

function SingleCurrencySummaryList({
  data,
  onMemberClick,
}: {
  data: SettlementSummaryData;
  onMemberClick?: (memberId: string, currencyCode: string) => void;
}) {
  const { currency } = useLocaleFormatters();
  const group = data.currencies[0];
  if (!group) return null;

  const members = [...group.members].sort(
    (a, b) =>
      Number(b.memberId === data.viewerMemberId) - Number(a.memberId === data.viewerMemberId),
  );
  const hasSpend = members.some((member) => member.share !== undefined);
  const hasPaidFor = members.some((member) => member.paidFor !== undefined);
  const hasIncludedIn = members.some((member) => member.includedIn !== undefined);
  const grid = balanceRowGrid[viewerCurrencyRowGridFor({ hasSpend, hasPaidFor, hasIncludedIn })];

  return (
    <section aria-label={`${group.currency} balances`} className="bleed space-y-3">
      <GroupTitle
        as="h3"
        className={`${grid} hidden bleed-px border-t border-rule pt-2 pb-0 text-xs @min-[38rem]:grid`}
      >
        <span aria-hidden="true" />
        {hasIncludedIn && (
          <span className="hidden text-xs font-medium uppercase text-ink-soft @min-[38rem]:block">
            Included in
          </span>
        )}
        {hasPaidFor && (
          <span className="hidden text-xs font-medium uppercase text-ink-soft @min-[38rem]:block">
            Paid for
          </span>
        )}
        {hasSpend && (
          <span className="hidden text-right text-xs font-medium uppercase text-ink-soft @min-[38rem]:block">
            Spent
          </span>
        )}
        <span className="hidden text-right text-xs font-medium uppercase text-ink-soft @min-[38rem]:block">
          Balance
        </span>
      </GroupTitle>
      <ul className="divide-y divide-rule border-b border-edge bg-field">
        {members.map((member) => {
          const spent = member.share ? currency(member.share, group.currency) : "No expenses";
          const isViewer = member.memberId === data.viewerMemberId;
          return (
            <li
              key={member.memberId}
              className={`${grid} relative bleed-px py-3 transition-colors hover:bg-wash has-[button:focus-visible]:bg-wash ${isViewer ? "z-10 border-y-2 border-forest" : ""}`}
            >
              <button
                type="button"
                aria-haspopup="dialog"
                aria-label={`View ${member.name}'s ${group.currency} balance breakdown`}
                onClick={() => onMemberClick?.(member.memberId, group.currency)}
                className="flex min-w-0 items-center gap-3 text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-forest"
              >
                <MemberAvatar id={member.memberId} name={member.name} size="md" />
                <span className="min-w-0 break-words">
                  {isViewer && <span className="block text-xs text-ink-soft">You</span>}
                  <span className="font-medium">{member.name}</span>
                </span>
              </button>
              {hasIncludedIn && (
                <span className="hidden text-ink-soft @min-[38rem]:block">
                  {member.includedIn ? (
                    <>
                      <span className="font-numeric">{member.includedIn}</span> expense
                      {member.includedIn === 1 ? "" : "s"}
                    </>
                  ) : (
                    "-"
                  )}
                </span>
              )}
              {hasPaidFor && (
                <span className="hidden text-ink-soft @min-[38rem]:block">
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
                <span className="hidden text-right @min-[38rem]:block">
                  {member.share ? (
                    <span className="font-numeric font-semibold text-ink">{spent}</span>
                  ) : (
                    <span className="text-xs text-ink-soft">{spent}</span>
                  )}
                </span>
              )}
              {hasSpend && (
                <span className="col-start-2 row-span-2 row-start-1 flex self-end justify-end @min-[38rem]:col-auto @min-[38rem]:row-auto @min-[38rem]:hidden">
                  <MobileBalanceValue
                    balance={member.balance}
                    balanceWithViewer={member.balanceWithViewer}
                    hasSharedExpenseWithViewer={member.hasSharedExpenseWithViewer}
                    code={group.currency}
                    spent={member.share ? spent : "-"}
                    memberId={member.memberId}
                    viewerMemberId={data.viewerMemberId}
                    suggestions={group.suggestions}
                  />
                </span>
              )}
              <span
                className={`${hasSpend ? "hidden @min-[38rem]:flex" : "col-start-2 row-span-2 row-start-1 flex self-end justify-end @min-[38rem]:col-auto @min-[38rem]:row-auto"} justify-end`}
              >
                <BalanceValue
                  balance={member.balance}
                  balanceWithViewer={member.balanceWithViewer}
                  hasSharedExpenseWithViewer={member.hasSharedExpenseWithViewer}
                  code={group.currency}
                  memberId={member.memberId}
                  viewerMemberId={data.viewerMemberId}
                  suggestions={group.suggestions}
                />
              </span>
              <MobileMemberCounts includedIn={member.includedIn} paidFor={member.paidFor} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function MemberSummaryList({
  data,
  onMemberClick,
}: {
  data: SettlementSummaryData;
  onMemberClick?: (memberId: string, currencyCode: string) => void;
}) {
  if (data.currencies.length === 1) {
    return <SingleCurrencySummaryList data={data} onMemberClick={onMemberClick} />;
  }
  if (!data.viewerMemberId) return null;

  const memberIds = [
    ...new Set(
      data.currencies.flatMap((group) =>
        group.members
          .filter((member) => member.memberId !== data.viewerMemberId)
          .map((member) => member.memberId),
      ),
    ),
  ];

  return (
    <div className="bleed divide-y divide-edge border-b border-edge">
      {memberIds.map((memberId) => {
        const groups = data.currencies.filter((group) =>
          group.members.some((member) => member.memberId === memberId),
        );
        return (
          <MultiCurrencyMemberBalanceCard
            key={memberId}
            groups={groups}
            memberId={memberId}
            viewerMemberId={data.viewerMemberId!}
            onMemberClick={onMemberClick}
          />
        );
      })}
    </div>
  );
}

export function SettlementSummary({
  data,
  onMemberClick,
  renderViewerCards = true,
}: {
  data: SettlementSummaryData;
  onMemberClick?: (memberId: string, currencyCode: string) => void;
  renderViewerCards?: boolean;
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
        <>
          {renderViewerCards && <ViewerBalanceCards data={data} onMemberClick={onMemberClick} />}
          <MemberSummaryList data={data} onMemberClick={onMemberClick} />
        </>
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
  const { currency, formatExpenseDate } = useLocaleFormatters();
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
  const breakdown = useTabBreakdown(slug, expenseView, day);
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
  const selectedSettlements: TabMemberSettlement[] = selectedMember
    ? (
        data.currencies.find((group) => group.currency === selectedMember.currency)?.suggestions ??
        []
      )
        .filter(
          (suggestion) =>
            suggestion.fromMemberId === selectedMember.memberId ||
            suggestion.toMemberId === selectedMember.memberId,
        )
        .map((suggestion) => {
          const group = data.currencies.find(
            (currencyGroup) => currencyGroup.currency === selectedMember.currency,
          );
          return {
            ...suggestion,
            fromName:
              group?.members.find((member) => member.memberId === suggestion.fromMemberId)?.name ??
              memberName(suggestion.fromMemberId),
            toName:
              group?.members.find((member) => member.memberId === suggestion.toMemberId)?.name ??
              memberName(suggestion.toMemberId),
          };
        })
    : [];
  const selectedExpense = expenses.find((expense) => expense.slug === selectedExpenseSlug);
  function openMemberBreakdown(memberId: string, currencyCode: string) {
    const member = data.currencies
      .find((group) => group.currency === currencyCode)
      ?.members.find((row) => row.memberId === memberId);
    if (member) {
      setSelectedMember({ memberId, currency: currencyCode, name: member.name });
      setMemberBreakdownOpen(true);
    }
  }
  return (
    <div className="@container space-y-5">
      <Panel bleedOnMobile className="@container card-inset" role="region" aria-label="Balances">
        <Dialog open={open} onOpenChange={setOpen}>
          {/* View payments is `secondary` and Breakdown stays a link (DESIGN.md
            § 5). On a phone, Breakdown shares the title row while the wider
            View payments action takes the row below. */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <SectionTitle className="flex items-center gap-2">
              <Scale aria-hidden="true" className="h-5 w-5 text-brass" strokeWidth={2.25} />
              Balances
              {data.currencies.length === 1 && (
                <span className="rounded-full bg-forest/10 px-2 py-0.5 font-numeric text-xs font-semibold text-ink">
                  {data.currencies[0]?.currency}
                </span>
              )}
            </SectionTitle>
            {data.currencies.length > 0 && (
              <Link
                to="/t/$slug/breakdown"
                params={{ slug }}
                className="group ml-auto inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md text-sm font-medium text-forest hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest @min-[38rem]:hidden"
              >
                Breakdown <ChevronRight aria-hidden="true" className="h-4 w-4 chevron-x" />
              </Link>
            )}
            <div className="ml-auto flex w-full items-center gap-3 @min-[38rem]:w-auto">
              <DialogTrigger
                render={
                  <Button variant="secondary" size="touch" className="w-full @min-[38rem]:w-auto" />
                }
              >
                View payments
              </DialogTrigger>
              {data.currencies.length > 0 && (
                <Link
                  to="/t/$slug/breakdown"
                  params={{ slug }}
                  className="group hidden min-h-11 shrink-0 items-center gap-1 rounded-md text-sm font-medium text-forest hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest @min-[38rem]:inline-flex"
                >
                  Breakdown <ChevronRight aria-hidden="true" className="h-4 w-4 chevron-x" />
                </Link>
              )}
            </div>
          </div>
          <ViewerBalanceCards data={data} onMemberClick={openMemberBreakdown} bleed />
          <SettlementSummary
            data={data}
            onMemberClick={openMemberBreakdown}
            renderViewerCards={false}
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
                                  <BalanceValue
                                    balance={member.balance}
                                    code={group.currency}
                                    memberId={member.memberId}
                                    viewerMemberId={viewData.viewerMemberId}
                                    suggestions={group.suggestions}
                                  />
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
                        size="md"
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
                  settlements={selectedSettlements}
                  viewerMemberId={data.viewerMemberId}
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
                      onChange={(event) =>
                        setPayment({ ...payment, amountText: event.target.value })
                      }
                      aria-invalid={!!paymentError}
                      aria-describedby={
                        paymentError ? "settlement-error" : "settlement-amount-help"
                      }
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
    </div>
  );
}
