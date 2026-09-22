import { MemberAvatar } from "@/components/MemberAvatar";
import { mobileRaisedSurfaceClass } from "@/components/ui/mobileRaisedSurface";
import { useLocaleFormatters } from "@/lib/localeFormatters";
import type { TabBreakdownMember } from "@/lib/tabSync";

export function TabMemberBreakdown({
  member,
  currencyCode,
  variant = "card",
  onExpenseClick,
}: {
  member: TabBreakdownMember;
  currencyCode: string;
  variant?: "card" | "modal";
  onExpenseClick?: (expenseSlug: string) => void;
}) {
  const { currency, formatExpenseDate, formatExpenseDateShort } = useLocaleFormatters();
  const modal = variant === "modal";
  // Both variants live inside a `card-inset` surface. Tables bleed to that
  // surface's horizontal edges and their rows restore the same inset.
  const inset = "bleed-px";
  return (
    <article
      className={
        modal
          ? "bleed @container"
          : `${mobileRaisedSurfaceClass} card-inset overflow-hidden border border-rule/70 bg-surface/80`
      }
    >
      {!modal && (
        <header className="pb-5">
          <div className="flex min-w-0 items-center gap-3">
            <MemberAvatar id={member.memberId} name={member.name} size="sm" />
            <div className="min-w-0">
              <p className="break-words text-sm font-medium text-ink">{member.name}</p>
              <p className="mt-1 text-xs text-ink-soft">
                {member.expenseCount} {member.expenseCount === 1 ? "expense" : "expenses"}
              </p>
            </div>
          </div>
        </header>
      )}

      {member.expenses.length === 0 ? (
        <p
          className={`${modal ? "" : "bleed"} border-y border-edge bg-field py-5 text-sm text-ink-soft ${inset}`}
        >
          Not part of any expenses yet.
        </p>
      ) : (
        <div
          className={
            modal ? "overflow-hidden border-y border-edge bg-field @min-[38rem]:border-t-0" : ""
          }
        >
          <ul
            className={`${modal ? "divide-y divide-rule/70 @min-[38rem]:grid @min-[38rem]:grid-cols-[4.75rem_minmax(0,1fr)_fit-content(9rem)_fit-content(8rem)_fit-content(8rem)] @min-[38rem]:gap-x-4" : "bleed divide-y divide-rule border-b border-edge"} text-sm`}
          >
            {modal && (
              <li className="hidden bleed-px py-2 text-xs font-medium uppercase text-ink-soft @min-[38rem]:col-span-full @min-[38rem]:grid @min-[38rem]:grid-cols-subgrid @min-[38rem]:gap-x-4 @min-[38rem]:border-b @min-[38rem]:border-edge @min-[38rem]:bg-surface">
                <span>Date</span>
                <span>Expense</span>
                <span>Paid by</span>
                <span className="text-right">Total</span>
                <span className="text-right">Spent</span>
              </li>
            )}
            {!modal && (
              <li
                className={`grid grid-cols-[minmax(0,1fr)_auto] items-center ${inset} bg-transparent py-2 text-xs font-medium uppercase text-ink-soft`}
              >
                <span>Expense</span>
                <span className="text-right">Spent</span>
              </li>
            )}
            {member.expenses.map((line) => (
              <li
                key={line.expenseSlug}
                className={`${modal ? "relative grid grid-cols-[auto_minmax(0,1fr)_fit-content(9.5rem)] items-start gap-x-4 gap-y-2 bg-field transition-colors hover:bg-wash has-[button:focus-visible]:bg-wash @min-[38rem]:col-span-full @min-[38rem]:grid-cols-subgrid @min-[38rem]:items-center" : "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 bg-field"} py-4 ${inset}`}
              >
                {modal ? (
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    onClick={() => onExpenseClick?.(line.expenseSlug)}
                    className="col-start-2 row-start-1 min-w-0 self-center break-words text-left font-semibold after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-forest @min-[38rem]:col-start-2 @min-[38rem]:self-auto"
                  >
                    <span className="block text-sm text-ink">
                      {line.expenseName || "Untitled expense"}
                    </span>
                  </button>
                ) : (
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-medium text-ink">
                      {line.expenseName || "Untitled expense"}
                    </p>
                    <time dateTime={line.date} className="mt-1 block text-xs text-ink-soft">
                      {formatExpenseDate(line.date) ?? line.date}
                    </time>
                  </div>
                )}
                {modal && (
                  <span className="col-start-2 row-start-2 flex min-w-0 items-center gap-3 @min-[38rem]:hidden">
                    {line.payerId && (
                      <MemberAvatar id={line.payerId} name={line.payerName} size="md" />
                    )}
                    <span className="min-w-0 break-words text-xs text-ink-soft">
                      Paid by <span className="text-sm text-ink">{line.payerName}</span>
                    </span>
                  </span>
                )}
                {modal && (
                  <span className="hidden min-w-0 items-center gap-3 break-words text-sm text-ink-soft @min-[38rem]:col-start-3 @min-[38rem]:flex">
                    {line.payerId && (
                      <MemberAvatar id={line.payerId} name={line.payerName} size="md" />
                    )}
                    <span className="min-w-0 break-words">{line.payerName}</span>
                  </span>
                )}
                {modal && (
                  <span className="col-start-3 row-start-1 min-w-0 self-start text-right @min-[38rem]:col-start-4 @min-[38rem]:row-auto @min-[38rem]:self-auto">
                    <span className="block font-numeric text-sm text-ink">
                      {currency(line.total, currencyCode)}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-soft @min-[38rem]:hidden">
                      Total
                    </span>
                  </span>
                )}
                {modal && (
                  <time
                    dateTime={line.date}
                    className="col-start-1 row-start-1 row-span-2 flex self-center whitespace-nowrap text-ink-soft @min-[38rem]:col-start-1 @min-[38rem]:row-start-1 @min-[38rem]:row-span-1"
                  >
                    <span className="flex flex-col leading-tight">
                      <span className="text-sm">
                        {formatExpenseDateShort(line.date) ?? line.date}
                      </span>
                      <span className="text-xs">{line.date.slice(0, 4)}</span>
                    </span>
                  </time>
                )}
                <div
                  className={`${modal ? "col-start-3 row-start-2 min-w-0 text-right @min-[38rem]:col-start-5 @min-[38rem]:row-auto" : "shrink-0 text-right"}`}
                >
                  <span className="block font-numeric text-sm font-semibold text-ink">
                    {currency(line.fairShare, currencyCode)}
                  </span>
                  {modal && (
                    <span className="block text-xs text-ink-soft @min-[38rem]:hidden">Spent</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!modal && (
        <dl
          className={`flex flex-wrap justify-between gap-x-6 gap-y-3 ${inset} bleed py-2 text-xs`}
        >
          <dt className="font-medium text-ink">Total spent</dt>
          <dd className="font-numeric font-semibold text-ink">
            {currency(member.totalSpent, currencyCode)}
          </dd>
        </dl>
      )}
    </article>
  );
}
