import { History, Undo2, X } from "lucide-react";
import type { FunctionReturnType } from "convex/server";

import type { api } from "../../convex/_generated/api";
import { MemberAvatar } from "@/components/MemberAvatar";
import { Button } from "@/components/ui/Button";
import { CurrencyPill } from "@/components/ui/CurrencyPill";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";
import { GroupTitle } from "@/components/ui/Typography";
import { useLocaleFormatters } from "@/lib/localeFormatters";

type SharedPaymentHistoryEntry = NonNullable<
  FunctionReturnType<typeof api.settlements.publicShare>
>["history"][number];

export function SharedPaymentHistory({
  history,
  defaultOpen = false,
}: {
  history: SharedPaymentHistoryEntry[];
  defaultOpen?: boolean;
}) {
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
    <Dialog defaultOpen={defaultOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="secondary"
            size="touch"
            className="min-w-max flex-1 px-3 sm:flex-none sm:px-5"
          />
        }
      >
        <History aria-hidden="true" />
        Payment history
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-5rem)] flex-col overflow-hidden p-0 sm:p-0">
        <header className="shrink-0 border-b border-rule/70 bg-surface p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle>Payment history</DialogTitle>
              <DialogDescription className="mt-1">
                {history.length} recorded {history.length === 1 ? "payment" : "payments"}.
              </DialogDescription>
            </div>
            <DialogClose
              aria-label="Close payment history"
              render={<Button variant="ghost" size="icon-touch" className="text-ink-soft" />}
            >
              <X aria-hidden="true" />
            </DialogClose>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto card-inset pt-0">
          {history.length === 0 ? (
            <p className="pt-5 text-sm text-ink-soft sm:pt-6">No payments recorded.</p>
          ) : (
            <ul className="bleed bg-field">
              {[...historyByDate].map(([date, payments]) => {
                const currencyGroups = [
                  ...payments.reduce<Map<string, SharedPaymentHistoryEntry[]>>(
                    (groups, payment) => {
                      const group = groups.get(payment.currency) ?? [];
                      group.push(payment);
                      groups.set(payment.currency, group);
                      return groups;
                    },
                    new Map(),
                  ),
                ];
                return (
                  <li key={date}>
                    <GroupTitle as="h3" className="bleed-px border-b border-rule bg-surface py-2">
                      <time dateTime={date}>{formatExpenseDate(date) ?? date}</time>
                    </GroupTitle>
                    <ul>
                      {currencyGroups.map(([currencyCode, currencyPayments], groupIndex) => (
                        <li
                          key={currencyCode}
                          className={groupIndex > 0 ? "border-t border-rule" : ""}
                        >
                          <div className="flex bg-surface py-2 bleed-px">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
