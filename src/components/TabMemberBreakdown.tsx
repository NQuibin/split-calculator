import { TabExpenseRow, type TabExpenseSettlementStatus } from "@/components/TabExpenseGrid";
import { expenseListGridClass } from "@/components/tabExpenseGridClass";
import { isUpcoming } from "@/lib/format";
import type { TabBreakdownMember } from "@/lib/tabSync";

export function TabMemberBreakdown({
  member,
  currencyCode,
  expenseStatuses,
  onExpenseClick,
}: {
  member: TabBreakdownMember;
  currencyCode: string;
  expenseStatuses?: {
    expenseSlug: string;
    memberId: string;
    status: TabExpenseSettlementStatus;
  }[];
  onExpenseClick?: (expenseSlug: string) => void;
}) {
  const expenses = member.expenses.filter((line) => line.sharedWithViewer);
  const { list: modalListGrid } = expenseListGridClass(true);
  return (
    <article className="bleed @container">
      {expenses.length === 0 ? (
        <p className="border-y border-edge bg-field py-5 text-sm text-ink-soft bleed-px">
          No related expenses.
        </p>
      ) : (
        <div className="overflow-hidden border-y border-edge bg-field">
          <ul className={`${modalListGrid} text-sm`}>
            {expenses.map((line) => {
              const upcoming = isUpcoming(line.date);
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
                    balance: line.viewerBalance,
                    memberName: undefined,
                    viewerPerspective: true,
                  }}
                  settlementStatus={
                    typeof line.viewerBalance === "number" && line.viewerBalance !== 0
                      ? expenseStatuses?.find(
                          (entry) =>
                            entry.expenseSlug === line.expenseSlug &&
                            entry.memberId === member.memberId,
                        )?.status
                      : undefined
                  }
                  onExpenseClick={() => onExpenseClick?.(line.expenseSlug)}
                />
              );
            })}
          </ul>
        </div>
      )}
    </article>
  );
}
