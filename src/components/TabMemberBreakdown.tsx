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
  return (
    <article
      className={
        modal
          ? "overflow-hidden bg-field"
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
        <p className="border-t border-rule/70 bg-field px-5 py-5 text-sm text-ink-soft sm:px-6">
          Not part of any expenses yet.
        </p>
      ) : (
        <>
          {modal && (
            <div className="flex items-center justify-between bg-band px-5 py-2 text-xs font-medium uppercase text-ink-soft sm:px-6">
              <span>Expense</span>
              <span>Share</span>
            </div>
          )}
          <ul
            className={`${modal ? "divide-y divide-rule" : "divide-y divide-rule/70 border-t border-rule/70"} bg-field text-sm`}
          >
            {member.expenses.map((line) => (
              <li
                key={line.expenseSlug}
                className={`${modal ? "relative transition-colors hover:bg-wash has-[button:focus-visible]:bg-wash" : ""} flex flex-wrap items-start justify-between gap-x-5 gap-y-2 px-5 py-4 sm:px-6`}
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
          </ul>
        </>
      )}

      <dl className="flex flex-wrap justify-between gap-x-6 gap-y-3 border-t border-rule/70 bg-band px-5 py-4 text-sm sm:px-6">
        <div className="flex items-baseline gap-2">
          <dt className="text-ink-soft">Total spent</dt>
          <dd className="font-numeric font-medium text-ink">
            {currency(member.totalSpent, currencyCode)}
          </dd>
        </div>
      </dl>
    </article>
  );
}
