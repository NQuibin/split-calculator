import { MemberAvatar } from "@/components/MemberAvatar";
import { UpcomingExpenseIcon } from "@/components/UpcomingExpenseIcon";
import { ChevronRight } from "lucide-react";
import { isUpcoming } from "@/lib/format";
import { useLocaleFormatters } from "@/lib/localeFormatters";
import { viewerBalanceLabel } from "@/lib/settlements";
import { expenseListGridClass } from "@/components/tabExpenseGridClass";

export type TabExpensePayer = { id: string; name: string } | undefined;

export type TabExpenseMemberContext = {
  balance: number | null | undefined;
  memberName?: string;
  viewerPerspective?: boolean;
  coversExpense?: boolean;
  neutralPerspective?: boolean;
};

export type TabExpenseSettlementStatus = "settled" | "partiallySettled" | "outstanding";

export function SettlementStatusPill({
  status,
  coversExpense = false,
}: {
  status: TabExpenseSettlementStatus;
  coversExpense?: boolean;
}) {
  if (status === "outstanding") return null;
  const label = coversExpense
    ? status === "settled"
      ? "Repaid"
      : "Partially repaid"
    : status === "settled"
      ? "Paid"
      : "Partially paid";
  return (
    <span
      className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${status === "settled" ? "bg-settled-chip text-forest" : "bg-partially-settled-chip text-brass-ink"}`}
    >
      {label}
    </span>
  );
}

/** An expense date as "Mar 3", with its year and upcoming marker. */
export function TabExpenseDate({ date }: { date: string | undefined }) {
  const { formatExpenseDateShort } = useLocaleFormatters();
  const short = formatExpenseDateShort(date);
  const upcoming = isUpcoming(date);
  return (
    <span className="inline-flex flex-col items-start whitespace-nowrap">
      {date && short ? (
        <time dateTime={date} className="flex flex-col leading-tight">
          <span className="text-sm">{short}</span>
          <span className="text-xs">{date.slice(0, 4)}</span>
        </time>
      ) : (
        "No date"
      )}
      {upcoming && (
        <span className="mt-1">
          <UpcomingExpenseIcon date={date} />
        </span>
      )}
    </span>
  );
}

/** An expense total, with the mobile-only label used by the tab list. */
export function TabExpenseAmount({
  total,
  code,
  upcoming,
  compact = false,
}: {
  total: number;
  code: string;
  upcoming: boolean;
  compact?: boolean;
}) {
  const { currency } = useLocaleFormatters();
  return (
    <>
      <span className={compact ? "font-numeric text-sm" : "block font-numeric text-sm"}>
        {currency(total, code)}
      </span>
      {!compact && (
        <span className="mt-0.5 block text-xs text-ink-soft @min-[38rem]:hidden">
          {upcoming ? "Total planned" : "Total"}
        </span>
      )}
    </>
  );
}

/** The selected member's net balance for an expense, matching the tab expense card. */
export function TabExpenseBalance({
  balance,
  code,
  projected,
  memberName,
  viewerPerspective = false,
  neutralPerspective = false,
}: {
  balance: number | null | undefined;
  code: string;
  projected: boolean;
  memberName?: string;
  viewerPerspective?: boolean;
  neutralPerspective?: boolean;
}) {
  const { currency } = useLocaleFormatters();
  if (balance === null) return <span className="text-sm text-ink-soft">Awaiting payer</span>;
  if (balance === undefined) {
    if (!viewerPerspective) return <span className="text-sm text-ink-soft">Not in split</span>;
    return (
      <span className="ml-auto block w-20 shrink-0 text-right text-sm text-ink-soft">
        No balance
      </span>
    );
  }
  if (balance === 0)
    return projected ? (
      <span className="ml-auto block w-20 shrink-0 text-right text-sm text-ink-soft">Not due</span>
    ) : (
      <span className="ml-auto block w-20 shrink-0 text-right text-sm text-ink-soft">
        No balance
      </span>
    );
  const owes = balance < 0;
  const balanceLabel = neutralPerspective
    ? owes
      ? "Owe"
      : "Are owed"
    : memberName
      ? `${memberName} ${owes ? "owes" : "gets"}`
      : viewerBalanceLabel(balance);
  return (
    <>
      <span className="hidden @min-[38rem]:block">
        <span className="block break-words text-sm text-ink-soft">
          {balanceLabel}{" "}
          <span
            className={`font-numeric text-sm font-semibold ${owes ? "text-margin-red-ink" : "text-ledger-green"}`}
          >
            {currency(Math.abs(balance), code)}
          </span>
        </span>
      </span>
      <span className="block @min-[38rem]:hidden">
        <span className="block text-sm text-ink-soft">{balanceLabel}</span>
        <span
          className={`block font-numeric text-sm font-semibold ${owes ? "text-margin-red-ink" : "text-ledger-green"}`}
        >
          {currency(Math.abs(balance), code)}
        </span>
      </span>
    </>
  );
}

/**
 * The shared responsive row used by the tab expense list and member-breakdown
 * modal. Callers select and calculate the row data; this component owns the
 * date, title, payer, total, and optional member-balance columns.
 */
export function TabExpenseRow({
  name,
  date,
  total,
  code,
  payer,
  upcoming,
  memberContext,
  settlementStatus,
  shareAmount,
  onExpenseClick,
}: {
  name: string;
  date: string | undefined;
  total: number;
  code: string;
  payer: TabExpensePayer;
  upcoming: boolean;
  memberContext?: TabExpenseMemberContext;
  settlementStatus?: TabExpenseSettlementStatus;
  shareAmount?: number;
  onExpenseClick?: () => void;
}) {
  const { currency } = useLocaleFormatters();
  const { row } = expenseListGridClass(memberContext !== undefined, !!onExpenseClick);
  const title = (
    <>
      <span className="block text-sm">{name}</span>
      {shareAmount !== undefined && (
        <span className="mt-0.5 block text-xs font-normal text-ink-soft">
          Share <span className="font-numeric">{currency(shareAmount, code)}</span>
        </span>
      )}
    </>
  );
  const memberName = memberContext?.memberName;
  const titleClassName =
    "col-start-1 col-span-2 row-start-1 min-w-0 self-center break-words text-left font-semibold @min-[38rem]:col-start-2 @min-[38rem]:col-span-1 @min-[38rem]:self-auto";

  return (
    <li
      className={`${row} relative py-4 ${onExpenseClick ? "group transition-colors hover:bg-wash active:bg-wash has-[button:focus-visible]:bg-wash" : ""}`}
    >
      {onExpenseClick ? (
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={onExpenseClick}
          className={`${titleClassName} after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-forest`}
        >
          {title}
        </button>
      ) : (
        <span className={titleClassName}>{title}</span>
      )}

      <span className="hidden min-w-0 items-center gap-2 text-sm text-ink @min-[38rem]:col-start-3 @min-[38rem]:flex">
        {payer && <MemberAvatar id={payer.id} name={payer.name} size="md" />}
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-1 gap-y-0.5">
          {payer ? (
            <span className="min-w-0 break-words">
              {payer.name} <span className="text-sm text-ink-soft">covered</span>
            </span>
          ) : (
            <span className="text-sm text-ink-soft">
              {upcoming ? "Not covered yet" : "Payer needed"}
            </span>
          )}
          <TabExpenseAmount total={total} code={code} upcoming={upcoming} compact />
        </span>
      </span>
      <span className="col-start-2 row-start-2 flex min-w-0 self-center items-center gap-x-2 @min-[38rem]:hidden">
        {payer && <MemberAvatar id={payer.id} name={payer.name} size="md" />}
        <span className="flex min-w-0 flex-col items-start gap-y-0.5">
          {payer ? (
            <span className="break-words text-sm text-ink">
              {payer.name} <span className="text-sm text-ink-soft">covered</span>
            </span>
          ) : (
            <span className="text-sm text-ink-soft">
              {upcoming ? "Not covered yet" : "Payer needed"}
            </span>
          )}
          <TabExpenseAmount total={total} code={code} upcoming={upcoming} compact />
        </span>
      </span>
      <span className="col-start-1 row-start-2 self-center text-xs text-ink-soft @min-[38rem]:col-start-1 @min-[38rem]:row-start-1 @min-[38rem]:text-sm">
        <TabExpenseDate date={date} />
      </span>
      {memberContext && (
        <span className="col-start-3 row-start-2 min-w-0 self-center text-right @min-[38rem]:col-start-4 @min-[38rem]:row-auto">
          <TabExpenseBalance
            balance={memberContext.balance}
            code={code}
            projected={upcoming}
            memberName={memberName}
            viewerPerspective={memberContext.viewerPerspective}
            neutralPerspective={memberContext.neutralPerspective}
          />
          {(settlementStatus === "settled" || settlementStatus === "partiallySettled") && (
            <SettlementStatusPill
              status={settlementStatus}
              coversExpense={memberContext.coversExpense}
            />
          )}
        </span>
      )}
      {onExpenseClick && (
        <ChevronRight
          aria-hidden="true"
          className={`-mr-1 col-start-3 row-start-1 h-5 w-5 shrink-0 self-center justify-self-end text-ink-soft chevron-x ${memberContext ? "@min-[38rem]:col-start-5" : "@min-[38rem]:col-start-4"}`}
        />
      )}
    </li>
  );
}
