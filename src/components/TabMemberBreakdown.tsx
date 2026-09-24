import { MemberAvatar } from "@/components/MemberAvatar";
import { TabExpenseHeader, TabExpenseRow } from "@/components/TabExpenseGrid";
import { expenseListGridClass } from "@/components/tabExpenseGridClass";
import { mobileRaisedSurfaceClass } from "@/components/ui/mobileRaisedSurface";
import { GroupTitle } from "@/components/ui/Typography";
import { isUpcoming } from "@/lib/format";
import { useLocaleFormatters } from "@/lib/localeFormatters";
import type { TabBreakdownMember } from "@/lib/tabSync";

export type TabMemberSettlement = {
  fromMemberId: string;
  fromName: string;
  toMemberId: string;
  toName: string;
  amount: number;
};

export function TabMemberBreakdown({
  member,
  currencyCode,
  variant = "card",
  onExpenseClick,
  settlements,
  viewerMemberId,
}: {
  member: TabBreakdownMember;
  currencyCode: string;
  variant?: "card" | "modal";
  onExpenseClick?: (expenseSlug: string) => void;
  settlements?: TabMemberSettlement[];
  viewerMemberId?: string | null;
}) {
  const { currency, formatExpenseDate } = useLocaleFormatters();
  const modal = variant === "modal";
  const { list: modalListGrid } = expenseListGridClass(true);
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

      {modal && (
        <section className="border-b border-rule pb-5" aria-label="Settlement breakdown">
          <GroupTitle as="h2" className="bleed-px">
            Settlement breakdown
          </GroupTitle>
          {settlements && settlements.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm text-ink">
              {settlements.map((settlement) => {
                const viewerOwes = settlement.fromMemberId === viewerMemberId;
                const viewerIsOwed = settlement.toMemberId === viewerMemberId;
                const amountTone = viewerOwes
                  ? "text-margin-red-ink"
                  : viewerIsOwed
                    ? "text-ledger-green"
                    : "text-ink";
                return (
                  <li
                    key={`${settlement.fromMemberId}-${settlement.toMemberId}`}
                    className="min-w-0 break-words bleed-px"
                  >
                    {viewerOwes ? (
                      <span className="font-semibold text-ink">You</span>
                    ) : (
                      <span className="font-semibold text-ink">{settlement.fromName}</span>
                    )}
                    {viewerOwes ? " owe " : " owes "}
                    {viewerIsOwed ? (
                      <span className="font-semibold text-ink">you</span>
                    ) : (
                      <span className="font-semibold text-ink">{settlement.toName}</span>
                    )}{" "}
                    <span className={`font-numeric font-semibold ${amountTone}`}>
                      {currency(settlement.amount, currencyCode)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="bleed-px mt-3 text-sm text-ink-soft">Settled up with everyone.</p>
          )}
        </section>
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
            className={`${modal ? modalListGrid : "bleed divide-y divide-rule border-b border-edge"} text-sm`}
          >
            {modal && <TabExpenseHeader showBalance />}
            {!modal && (
              <li
                className={`grid grid-cols-[minmax(0,1fr)_auto] items-center ${inset} bg-transparent py-2 text-xs font-medium uppercase text-ink-soft`}
              >
                <span>Expense</span>
                <span className="text-right">Spent</span>
              </li>
            )}
            {member.expenses.map((line) => {
              const upcoming = isUpcoming(line.date);
              const showSpent =
                modal &&
                line.payerId === member.memberId &&
                typeof line.balance === "number" &&
                line.balance > 0;
              if (modal) {
                return (
                  <TabExpenseRow
                    key={line.expenseSlug}
                    name={line.expenseName || "Untitled expense"}
                    date={line.date}
                    total={line.total}
                    code={currencyCode}
                    payer={line.payerId ? { id: line.payerId, name: line.payerName } : undefined}
                    upcoming={upcoming}
                    memberContext={{
                      balance: line.balance,
                      memberName: member.memberId === viewerMemberId ? undefined : member.name,
                      spent: showSpent ? line.fairShare : undefined,
                    }}
                    onExpenseClick={() => onExpenseClick?.(line.expenseSlug)}
                  />
                );
              }
              return (
                <li
                  key={line.expenseSlug}
                  className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 bg-field py-4 ${inset}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-medium text-ink">
                      {line.expenseName || "Untitled expense"}
                    </p>
                    <time dateTime={line.date} className="mt-1 block text-xs text-ink-soft">
                      {formatExpenseDate(line.date) ?? line.date}
                    </time>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="block font-numeric text-sm font-semibold text-ink">
                      {currency(line.fairShare, currencyCode)}
                    </span>
                  </div>
                </li>
              );
            })}
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
