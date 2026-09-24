import { MemberAvatar } from "@/components/MemberAvatar";
import { UpcomingExpenseIcon } from "@/components/UpcomingExpenseIcon";
import { Check } from "lucide-react";
import { isUpcoming } from "@/lib/format";
import { useLocaleFormatters } from "@/lib/localeFormatters";
import { viewerBalanceLabel } from "@/lib/settlements";
import { expenseListGridClass } from "@/components/tabExpenseGridClass";

export type TabExpensePayer = { id: string; name: string } | undefined;

export type TabExpenseMemberContext = {
  balance: number | null | undefined;
  memberName?: string;
  spent?: number;
};

/** The payer identity shown in the desktop payer column. */
export function TabExpensePayer({
  payer,
  upcoming,
}: {
  payer: TabExpensePayer;
  upcoming: boolean;
}) {
  if (!payer) {
    return (
      <span className="text-xs text-ink-soft">{upcoming ? "Not paid yet" : "Payer needed"}</span>
    );
  }
  return (
    <span className="flex min-w-0 items-center gap-3">
      <MemberAvatar id={payer.id} name={payer.name} size="md" />
      <span className="truncate text-sm text-ink-soft">{payer.name}</span>
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
  spent,
  spentLabel = "You spent",
}: {
  balance: number | null | undefined;
  code: string;
  projected: boolean;
  memberName?: string;
  spent?: number;
  spentLabel?: string;
}) {
  const { currency } = useLocaleFormatters();
  if (balance === null) return <span className="text-xs text-ink-soft">Awaiting payer</span>;
  if (balance === undefined) return <span className="text-xs text-ink-soft">Not in split</span>;
  if (balance === 0)
    return projected ? (
      <span className="text-sm text-ink">Not due</span>
    ) : (
      <span className="inline-flex shrink-0 flex-col items-center text-ledger-green">
        <Check aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
        <span className="text-xs text-ink-soft">Settled</span>
      </span>
    );
  const owes = balance < 0;
  const balanceLabel = memberName
    ? `${memberName} ${owes ? "owes" : "gets"}`
    : viewerBalanceLabel(balance);
  const hasSpent = typeof spent === "number";
  return (
    <>
      <span className="hidden @min-[38rem]:block">
        {hasSpent && (
          <span className="block text-sm text-ink-soft">
            {spentLabel}{" "}
            <span className="font-numeric font-semibold text-ink">{currency(spent, code)}</span>
          </span>
        )}
        <span
          className={`block text-sm font-semibold ${owes ? "text-margin-red-ink" : "text-ledger-green"}`}
        >
          {balanceLabel} <span className="font-numeric">{currency(Math.abs(balance), code)}</span>
        </span>
      </span>
      <span className="block @min-[38rem]:hidden">
        {hasSpent && (
          <>
            <span className="block text-xs text-ink-soft">{spentLabel}</span>
            <span className="block font-numeric text-sm font-semibold text-ink">
              {currency(spent, code)}
            </span>
          </>
        )}
        <span className={`${hasSpent ? "mt-2 " : ""}block text-xs text-ink-soft`}>
          {balanceLabel}
        </span>
        <span
          className={`block font-numeric text-sm font-semibold ${owes ? "text-margin-red-ink" : "text-ledger-green"}`}
        >
          {owes ? "\u2212" : "+"}
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
  onExpenseClick,
}: {
  name: string;
  date: string | undefined;
  total: number;
  code: string;
  payer: TabExpensePayer;
  upcoming: boolean;
  memberContext?: TabExpenseMemberContext;
  onExpenseClick?: () => void;
}) {
  const { row } = expenseListGridClass(memberContext !== undefined);
  const title = <span className="block text-sm">{name}</span>;
  const memberName = memberContext?.memberName;
  const spentLabel = memberName ? `${memberName} spent` : "You spent";
  const titleClassName =
    "col-start-2 row-start-1 min-w-0 self-center break-words text-left font-semibold @min-[38rem]:col-start-2 @min-[38rem]:self-auto";

  return (
    <li
      className={`${row} relative py-4 transition-colors hover:bg-wash has-[button:focus-visible]:bg-wash`}
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

      <span className="hidden min-w-0 @min-[38rem]:col-start-3 @min-[38rem]:block">
        <TabExpensePayer payer={payer} upcoming={upcoming} />
      </span>
      <span className="col-start-2 row-start-2 flex min-w-0 items-center gap-x-2 @min-[38rem]:hidden">
        {payer && <MemberAvatar id={payer.id} name={payer.name} size="md" />}
        <span className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1">
          {payer ? (
            <span className="break-words text-sm text-ink">
              {payer.name} <span className="text-xs text-ink-soft">paid</span>
            </span>
          ) : (
            <span className="text-xs text-ink-soft">
              {upcoming ? "Not paid yet" : "Payer needed"}
            </span>
          )}
          <TabExpenseAmount total={total} code={code} upcoming={upcoming} compact />
        </span>
      </span>
      <span className="hidden min-w-0 self-start text-right @min-[38rem]:col-start-4 @min-[38rem]:row-auto @min-[38rem]:block @min-[38rem]:self-auto">
        <TabExpenseAmount total={total} code={code} upcoming={upcoming} />
      </span>
      <span className="col-start-1 row-start-1 row-span-2 self-center text-xs text-ink-soft @min-[38rem]:col-start-1 @min-[38rem]:row-start-1 @min-[38rem]:row-span-1 @min-[38rem]:text-sm">
        <TabExpenseDate date={date} />
      </span>
      {memberContext && (
        <span className="col-start-3 row-start-1 row-span-2 min-w-0 self-center text-right @min-[38rem]:col-start-5 @min-[38rem]:row-auto @min-[38rem]:row-span-1">
          <TabExpenseBalance
            balance={memberContext.balance}
            code={code}
            projected={upcoming}
            memberName={memberName}
            spent={memberContext.spent}
            spentLabel={spentLabel}
          />
        </span>
      )}
    </li>
  );
}

/** The shared desktop header for responsive tab expense rows. */
export function TabExpenseHeader({ showBalance }: { showBalance: boolean }) {
  const { row } = expenseListGridClass(showBalance);
  return (
    <li
      className={`${row} hidden border-b border-edge bg-surface py-2 text-xs font-medium uppercase text-ink-soft @min-[38rem]:grid`}
    >
      <span className="@min-[38rem]:col-start-1">Date</span>
      <span className="@min-[38rem]:col-start-2">Expense</span>
      <span className="@min-[38rem]:col-start-3">Paid by</span>
      <span className="text-right @min-[38rem]:col-start-4">Total</span>
      {showBalance && <span className="text-right @min-[38rem]:col-start-5">Balance</span>}
    </li>
  );
}
