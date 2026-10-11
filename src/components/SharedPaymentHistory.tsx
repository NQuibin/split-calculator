import { Undo2 } from "lucide-react";
import type { FunctionReturnType } from "convex/server";

import type { api } from "../../convex/_generated/api";
import { MemberAvatar } from "@/components/MemberAvatar";
import { CurrencyPill } from "@/components/ui/CurrencyPill";
import { Panel } from "@/components/ui/Page";
import { GroupTitle, SectionTitle } from "@/components/ui/Typography";
import { useLocaleFormatters } from "@/lib/localeFormatters";

type SharedPaymentHistoryEntry = NonNullable<
  FunctionReturnType<typeof api.settlements.publicShare>
>["history"][number];

export function SharedPaymentHistory({ history }: { history: SharedPaymentHistoryEntry[] }) {
  const { currency, formatExpenseDate } = useLocaleFormatters();
  const historyByDate = history.reduce<Map<string, SharedPaymentHistoryEntry[]>>(
    (groups, payment) => {
      const group = groups.get(payment.date) ?? [];
      group.push(payment);
      groups.set(payment.date, group);
      return groups;
    },
    new Map(),
  );

  return (
    <Panel className="p-0">
      <div className="px-5 py-4 sm:px-6">
        <SectionTitle>Payment history</SectionTitle>
        <p className="mt-1 text-sm text-ink-soft">
          {history.length} recorded {history.length === 1 ? "payment" : "payments"}.
        </p>
      </div>
      {history.length === 0 ? (
        <p className="border-t border-rule px-5 py-8 text-sm text-ink-soft sm:px-6">
          No payments recorded.
        </p>
      ) : (
        <ul className="bg-field">
          {[...historyByDate].map(([date, payments]) => {
            const currencyGroups = [
              ...payments.reduce<Map<string, SharedPaymentHistoryEntry[]>>((groups, payment) => {
                const group = groups.get(payment.currency) ?? [];
                group.push(payment);
                groups.set(payment.currency, group);
                return groups;
              }, new Map()),
            ];
            return (
              <li key={date}>
                <GroupTitle as="h3" className="border-b border-rule bg-surface px-5 py-2 sm:px-6">
                  <time dateTime={date}>{formatExpenseDate(date) ?? date}</time>
                </GroupTitle>
                <ul>
                  {currencyGroups.map(([currencyCode, currencyPayments], groupIndex) => (
                    <li key={currencyCode} className={groupIndex > 0 ? "border-t border-rule" : ""}>
                      <div className="flex bg-surface px-5 py-2 sm:px-6">
                        <CurrencyPill code={currencyCode} />
                      </div>
                      <ul
                        className={`divide-y divide-rule bg-field ${groupIndex === 0 ? "border-t border-edge" : ""} ${groupIndex === currencyGroups.length - 1 ? "border-b border-edge" : ""}`}
                      >
                        {currencyPayments.map((payment) => (
                          <li
                            key={payment.key}
                            className="grid min-h-16 min-w-0 grid-cols-[2.75rem_minmax(0,1fr)_max-content] items-center gap-3 px-4 py-3"
                          >
                            {payment.isReversal ? (
                              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-margin-red-ink">
                                <Undo2 aria-hidden="true" className="size-5" />
                              </span>
                            ) : (
                              <MemberAvatar
                                id={payment.fromMemberId}
                                name={payment.from}
                                size="lg"
                              />
                            )}
                            <div className="min-w-0">
                              <p className="break-words text-sm text-ink">
                                <span className="font-medium">
                                  {payment.isReversal ? payment.to : payment.from}
                                </span>{" "}
                                →{" "}
                                <span className="font-medium">
                                  {payment.isReversal ? payment.from : payment.to}
                                </span>
                              </p>
                              {(payment.reversed || payment.isReversal || payment.note) && (
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                                  {payment.reversed && (
                                    <span className="rounded-full bg-chip-neutral px-2 py-0.5 text-ink">
                                      Reversed
                                    </span>
                                  )}
                                  {payment.isReversal && "Payment reversal"}
                                  {payment.note && (
                                    <span className="min-w-0 break-words">{payment.note}</span>
                                  )}
                                </div>
                              )}
                            </div>
                            <span
                              className={`shrink-0 text-right font-numeric text-sm font-semibold ${payment.isReversal ? "text-margin-red-ink" : "text-ink"}`}
                            >
                              {payment.isReversal && "−"}
                              {currency(payment.amount, payment.currency)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
