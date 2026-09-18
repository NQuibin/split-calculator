import { MemberAvatar } from "@/components/MemberAvatar";
import { SectionTitle } from "@/components/ui/Typography";
import { mobileRaisedSurfaceClass } from "@/components/ui/mobileRaisedSurface";
import { currency, parseISODate } from "@/lib/format";
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
  const modal = variant === "modal";
  // The card has no padding of its own, so its rows supply the card's inset.
  // The modal sits inside a `card-inset` dialog body, so the whole article
  // bleeds out to the dialog's edges and each row puts the inset back
  // (DESIGN.md "Data tables").
  const inset = modal ? "bleed-px" : "px-5 sm:px-6";
  const totalAmount = member.expenses.reduce((total, line) => total + line.total, 0);
  return (
    <article
      className={
        modal
          ? "bleed"
          : `${mobileRaisedSurfaceClass} overflow-hidden border border-rule/70 bg-surface/80`
      }
    >
      {!modal && (
        <header className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <MemberAvatar id={member.memberId} name={member.name} size="lg" />
            <div className="min-w-0">
              <SectionTitle>{member.name}</SectionTitle>
              <p className="mt-1 text-xs text-ink-soft">
                {member.expenseCount} {member.expenseCount === 1 ? "expense" : "expenses"}
              </p>
            </div>
          </div>
          {!modal && member.expenses.length ? (
            <span>
              <span className="block text-xs text-ink-soft">Total spent</span>
              <span className="block font-numeric text-lg font-semibold text-ink">
                {currency(member.totalSpent, currencyCode)}
              </span>
            </span>
          ) : !modal ? (
            <span className="text-sm text-ink-soft">No expenses</span>
          ) : null}
          {modal && <span className="text-xs text-ink-soft">{currencyCode}</span>}
        </header>
      )}

      {member.expenses.length === 0 ? (
        <p className={`border-y border-edge bg-field py-5 text-sm text-ink-soft ${inset}`}>
          Not part of any expenses yet.
        </p>
      ) : (
        <ul
          // The modal's header and totals rows have to be `<li>`s of this list
          // to share its subgrid, so its body can't be one element carrying
          // both rules the way DESIGN.md "Data tables" describes. Both rows
          // always render in the modal, though, so the rules sit on them
          // instead - the concern that puts rules on the body (a header or
          // footer that sometimes doesn't render) doesn't arise here.
          className={`${modal ? "grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,2fr)_minmax(9rem,1fr)_minmax(6rem,auto)_minmax(5rem,auto)]" : "divide-y divide-rule border-y border-edge bg-field"} text-sm`}
        >
          {modal && (
            <li className="col-span-full grid grid-cols-[subgrid] items-center gap-x-3 border-b border-edge bleed-px py-2 text-xs font-medium uppercase text-ink-soft sm:gap-x-5">
              <span>Expense</span>
              <span aria-hidden="true" className="sm:hidden" />
              <span className="hidden sm:block">Paid by</span>
              <span className="hidden text-right sm:block">Amount</span>
              <span className="text-right">Spent</span>
            </li>
          )}
          {member.expenses.map((line, index) => (
            <li
              key={line.expenseSlug}
              className={`${modal ? `relative col-span-full grid grid-cols-[subgrid] items-center gap-x-3 bg-field transition-colors hover:bg-wash has-[button:focus-visible]:bg-wash sm:gap-x-5 ${index > 0 ? "border-t border-rule" : ""}` : "flex flex-wrap items-start justify-between gap-x-5 gap-y-2"} py-4 ${inset}`}
            >
              {modal ? (
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => onExpenseClick?.(line.expenseSlug)}
                  className="min-w-0 flex-1 text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-forest"
                >
                  <p className="break-words font-medium text-ink">
                    {line.expenseName || "Untitled expense"}
                  </p>
                  <time dateTime={line.date} className="mt-1 block text-xs text-ink-soft">
                    {parseISODate(line.date)?.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }) ?? line.date}
                  </time>
                </button>
              ) : (
                <div className="min-w-0 flex-1">
                  <p className="break-words font-medium text-ink">
                    {line.expenseName || "Untitled expense"}
                  </p>
                  <time dateTime={line.date} className="mt-1 block text-xs text-ink-soft">
                    {parseISODate(line.date)?.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }) ?? line.date}
                  </time>
                </div>
              )}
              {modal && (
                <span className="min-w-0 text-xs text-ink-soft sm:hidden">
                  <span className="block break-words">
                    <span className="font-medium text-ink">{line.payerName}</span> paid
                  </span>
                  <span className="mt-1 block font-numeric text-ink">
                    {currency(line.total, currencyCode)}
                  </span>
                </span>
              )}
              {modal && (
                <span className="hidden min-w-0 items-center gap-2 break-words text-sm text-ink-soft sm:flex">
                  {line.payerId && (
                    <MemberAvatar id={line.payerId} name={line.payerName} size="sm" />
                  )}
                  <span className="min-w-0 break-words sm:font-semibold sm:text-ink">
                    {line.payerName}
                  </span>
                </span>
              )}
              {modal && (
                <span className="hidden shrink-0 text-right font-numeric text-sm text-ink sm:block">
                  {currency(line.total, currencyCode)}
                </span>
              )}
              <div className="shrink-0 text-right">
                <p className="text-ink">
                  {!modal && <span className="text-xs text-ink-soft">Share </span>}
                  <span className="font-numeric font-medium">
                    {currency(line.fairShare, currencyCode)}
                  </span>
                </p>
              </div>
            </li>
          ))}
          {modal && (
            <li className="col-span-full grid grid-cols-[subgrid] items-center gap-x-3 border-t border-edge bleed-px py-2 text-xs sm:gap-x-5">
              <dl className="contents">
                <dt className="font-medium text-ink">
                  <span className="sm:hidden">Total spent</span>
                  <span className="hidden sm:inline">Total</span>
                </dt>
                <dd aria-hidden="true" />
                <dd className="hidden justify-self-end font-numeric font-semibold text-ink sm:block">
                  {currency(totalAmount, currencyCode)}
                </dd>
                <dd className="justify-self-end font-numeric font-semibold text-ink">
                  {currency(member.totalSpent, currencyCode)}
                </dd>
              </dl>
            </li>
          )}
        </ul>
      )}

      {(!modal || member.expenses.length === 0) && (
        <dl
          className={`flex flex-wrap justify-between gap-x-6 gap-y-3 ${inset} ${
            modal ? "py-2 text-xs" : "py-4 text-sm"
          }`}
        >
          {modal ? (
            <>
              <dt className="font-medium text-ink">Total spent</dt>
              <dd className="font-numeric font-semibold text-ink">
                {currency(member.totalSpent, currencyCode)}
              </dd>
            </>
          ) : (
            <div className="flex items-baseline gap-2">
              <dt className="text-ink-soft">Total spent</dt>
              <dd className="font-numeric font-medium text-ink">
                {currency(member.totalSpent, currencyCode)}
              </dd>
            </div>
          )}
        </dl>
      )}
    </article>
  );
}
