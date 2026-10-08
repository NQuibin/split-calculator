import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Check, ChevronDown, Copy, Undo2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { api } from "../../convex/_generated/api";
import { MemberAvatar } from "@/components/MemberAvatar";
import { Breadcrumb, BreadcrumbCurrent, crumbLinkClass } from "@/components/ui/Breadcrumb";
import { Button } from "@/components/ui/Button";
import { EmptyState, Page, Panel } from "@/components/ui/Page";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageTitle, SectionTitle } from "@/components/ui/Typography";
import { todayISODate } from "@/lib/format";
import { useLocaleFormatters } from "@/lib/localeFormatters";

function AnimatedDisclosure({
  trigger,
  children,
  defaultOpen = false,
  triggerClassName = "group flex min-h-11 w-full items-center justify-between gap-3 px-5 py-3 text-left text-sm hover:bg-wash focus-visible:outline-2 focus-visible:outline-forest sm:px-6",
  label,
}: {
  trigger: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  triggerClassName?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const reduceMotion = useReducedMotion();
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((current) => !current)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function SharedTabPage({
  slug,
  share,
  view,
}: {
  slug: string;
  share?: string;
  view: "breakdown" | "history";
}) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const navigate = useNavigate();
  const getOrCreateShareToken = useMutation(api.tabs.getOrCreateShareToken);
  const { currency, formatExpenseDate } = useLocaleFormatters();
  const [asOfDate] = useState(todayISODate);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [shareErrorSlug, setShareErrorSlug] = useState<string | null>(null);
  const resolvingFor = useRef<string | null>(null);
  const data = useQuery(
    api.settlements.publicShare,
    share ? { slug, shareToken: share, asOfDate } : "skip",
  );

  useEffect(() => {
    if (share || isLoading || !isAuthenticated || resolvingFor.current === slug) return;
    resolvingFor.current = slug;
    void getOrCreateShareToken({ slug })
      .then((token) =>
        navigate({
          to: "/t/$slug/breakdown",
          params: { slug },
          search: { share: token, view },
          replace: true,
        }),
      )
      .catch(() => setShareErrorSlug(slug));
  }, [share, isLoading, isAuthenticated, slug, view, getOrCreateShareToken, navigate]);

  if ((!share && !isLoading && !isAuthenticated) || shareErrorSlug === slug || data === null) {
    return (
      <Page width="narrow" center>
        <EmptyState status={false}>This shared tab link is unavailable.</EmptyState>
      </Page>
    );
  }

  if (!share || data === undefined) {
    return (
      <Page>
        <div role="status" className="space-y-6">
          <span className="sr-only">Loading shared tab…</span>
          <Skeleton className="h-9 w-56 rounded-md" />
          <Skeleton className="h-11 w-72 max-w-full rounded-full" />
          <Panel className="space-y-5 p-6">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
          </Panel>
        </div>
      </Page>
    );
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }

  const members = data.currencies[0]?.members ?? [];
  const memberName = (key: string) =>
    members.find((member) => member.key === key)?.name ?? "Member";
  const expenseStatus = (expenseSlug: string, memberId: string): ReactNode => {
    const status = data.expenseStatuses?.find(
      (entry) => entry.expenseSlug === expenseSlug && entry.memberId === memberId,
    )?.status;
    const label =
      status === "settled" ? "Settled" : status === "partiallySettled" ? "Partially Settled" : null;
    return label && <span className="block font-sans text-xs text-ink-soft">{label}</span>;
  };
  const historyByDate = data.history.reduce<Map<string, typeof data.history>>((groups, payment) => {
    const group = groups.get(payment.date) ?? [];
    group.push(payment);
    groups.set(payment.date, group);
    return groups;
  }, new Map());

  return (
    <Page>
      {isAuthenticated && (
        <Breadcrumb>
          <Link to="/tabs" className={crumbLinkClass}>
            Tabs
          </Link>
          <Link to="/t/$slug" params={{ slug }} className={crumbLinkClass}>
            {data.tab.name}
          </Link>
          <BreadcrumbCurrent>Breakdown</BreadcrumbCurrent>
        </Breadcrumb>
      )}
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <PageTitle>{data.tab.name} Breakdown</PageTitle>
        </div>
        <div className="w-full sm:w-auto">
          <Button
            type="button"
            variant="secondary"
            size="touch"
            className="w-full sm:w-auto"
            onClick={() => void copyLink()}
          >
            {copied ? (
              <Check aria-hidden="true" className="size-4" />
            ) : (
              <Copy aria-hidden="true" className="size-4" />
            )}
            {copied ? "Link copied" : "Copy link"}
          </Button>
          {copyError && (
            <p role="alert" className="mt-2 text-xs text-margin-red-ink">
              Couldn’t copy the link.
            </p>
          )}
        </div>
      </header>
      <SegmentedTabs
        value={view}
        label="Shared tab pages"
        options={[
          { value: "breakdown", label: "Breakdown" },
          { value: "history", label: "Payment history" },
        ]}
        onChange={(next) => {
          void navigate({
            to: "/t/$slug/breakdown",
            params: { slug },
            search: { share, view: next },
          });
        }}
      >
        {view === "breakdown" ? (
          <div className="space-y-6">
            {members.length === 0 && <EmptyState>No members or expenses yet.</EmptyState>}
            {members.map((person) => {
              const sections = data.currencies.flatMap((group) => {
                const member = group.members.find((entry) => entry.key === person.key);
                if (!member) return [];
                const settlements = group.settlements.filter(
                  (entry) => entry.from === person.key || entry.to === person.key,
                );
                if (
                  member.expenses.length === 0 &&
                  member.balance === 0 &&
                  settlements.length === 0
                )
                  return [];
                return [{ group, member, settlements }];
              });
              return (
                <Panel key={person.key}>
                  <SectionTitle className="sr-only">{person.name}</SectionTitle>
                  <AnimatedDisclosure
                    defaultOpen
                    label={`${person.name} breakdown`}
                    triggerClassName="group flex min-h-11 w-full items-start gap-3 px-5 py-5 text-left hover:bg-wash focus-visible:outline-2 focus-visible:outline-forest sm:px-6"
                    trigger={
                      <>
                        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                          <MemberAvatar id={person.key} name={person.name} size="lg" />
                          <span className="min-w-0">
                            <SectionTitle as="span">{person.name}</SectionTitle>
                            <span className="block text-xs text-ink-soft">
                              {sections.reduce(
                                (count, section) => count + section.member.expenses.length,
                                0,
                              )}{" "}
                              expenses · {sections.length}{" "}
                              {sections.length === 1 ? "currency" : "currencies"}
                            </span>
                          </span>
                          <span className="flex w-full flex-wrap gap-x-6 gap-y-2 pl-14 sm:ml-auto sm:w-auto sm:pl-0">
                            {sections.map(({ group, member }) => (
                              <span key={group.currency}>
                                <span className="block text-xs text-ink-soft">
                                  {group.currency} ·{" "}
                                  {member.balance > 0
                                    ? "Is owed"
                                    : member.balance < 0
                                      ? "Owes"
                                      : "No balance"}
                                </span>
                                {member.balance !== 0 && (
                                  <span
                                    className={`block font-numeric text-sm font-semibold ${member.balance > 0 ? "text-ledger-green" : "text-margin-red-ink"}`}
                                  >
                                    {currency(Math.abs(member.balance), group.currency)}
                                  </span>
                                )}
                              </span>
                            ))}
                          </span>
                        </span>
                        <ChevronDown
                          aria-hidden="true"
                          className="chevron-flip mt-3 size-4 shrink-0 text-forest"
                        />
                      </>
                    }
                  >
                    <div className="pb-5">
                      {sections.length === 0 && (
                        <p className="border-t border-rule px-5 py-5 text-sm text-ink-soft sm:px-6">
                          No expenses or balances for this member.
                        </p>
                      )}
                      {sections.map(({ group, member, settlements }, index) => (
                        <section
                          key={group.currency}
                          className={
                            index === 0 ? "border-t border-rule" : "md:border-t md:border-rule"
                          }
                        >
                          <div className="flex items-center gap-2 px-5 py-3 sm:px-6">
                            <span className="inline-flex rounded-full border border-rule bg-chip-neutral px-3 py-1 font-numeric text-xs font-semibold">
                              {group.currency}
                            </span>
                            <span className="text-xs text-ink-soft">
                              {member.expenses.length}{" "}
                              {member.expenses.length === 1 ? "expense" : "expenses"}
                            </span>
                          </div>
                          <div className="grid md:grid-cols-2">
                            <div className="min-w-0 md:border-r md:border-edge">
                              <h3 className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-soft sm:px-6">
                                Expense breakdown
                              </h3>
                              {member.expenses.length === 0 ? (
                                <p className="border-y border-edge bg-field px-5 py-4 text-sm text-ink-soft sm:px-6">
                                  No expenses.
                                </p>
                              ) : (
                                <>
                                  <ul className="divide-y divide-rule border-y border-edge bg-field">
                                    {member.expenses.map((expense) => (
                                      <li key={expense.key}>
                                        {expense.items.length > 0 ? (
                                          <AnimatedDisclosure
                                            trigger={
                                              <>
                                                <span className="min-w-0">
                                                  <span className="flex items-center gap-1 font-medium">
                                                    <span className="break-words">
                                                      {expense.name || "Untitled expense"}
                                                    </span>
                                                    <ChevronDown
                                                      aria-hidden="true"
                                                      className="chevron-flip size-4 shrink-0 text-forest"
                                                    />
                                                  </span>
                                                  <time
                                                    className="text-xs text-ink-soft"
                                                    dateTime={expense.date}
                                                  >
                                                    {formatExpenseDate(expense.date) ??
                                                      expense.date}
                                                  </time>
                                                </span>
                                                <span className="shrink-0 text-right font-numeric text-sm">
                                                  {expense.shareAmount > 0 && (
                                                    <span className="block text-ink-soft">
                                                      Share{" "}
                                                      {currency(
                                                        expense.shareAmount,
                                                        group.currency,
                                                      )}
                                                    </span>
                                                  )}
                                                  {expense.paidAmount > 0 && (
                                                    <span className="block">
                                                      Paid{" "}
                                                      {currency(expense.paidAmount, group.currency)}
                                                    </span>
                                                  )}
                                                  {expenseStatus(expense.key, person.key)}
                                                </span>
                                              </>
                                            }
                                          >
                                            <div className="border-t border-rule bg-field px-5 py-3 text-xs sm:px-6">
                                              <div className="grid grid-cols-[minmax(0,1fr)_5.25rem_5.25rem] gap-x-3 pb-2 font-semibold text-ink-soft">
                                                <span>Item</span>
                                                <span className="text-right">Share</span>
                                                <span className="text-right">Total cost</span>
                                              </div>
                                              {expense.items.map((item) => (
                                                <div
                                                  key={item.key}
                                                  className="grid grid-cols-[minmax(0,1fr)_5.25rem_5.25rem] gap-x-3 py-1"
                                                >
                                                  <span className="min-w-0 break-words">
                                                    {item.name}
                                                  </span>
                                                  <span className="text-right font-numeric">
                                                    {currency(item.share, group.currency)}
                                                  </span>
                                                  <span className="text-right font-numeric">
                                                    {currency(item.total, group.currency)}
                                                  </span>
                                                </div>
                                              ))}
                                              {expense.taxTotal > 0 && (
                                                <div className="flex justify-between gap-3 py-1">
                                                  <span>Tax (included)</span>
                                                  <span className="font-numeric">
                                                    {currency(expense.taxTotal, group.currency)}
                                                  </span>
                                                </div>
                                              )}
                                              {expense.tipTotal > 0 && (
                                                <div className="flex justify-between gap-3 py-1">
                                                  <span>Tip (included)</span>
                                                  <span className="font-numeric">
                                                    {currency(expense.tipTotal, group.currency)}
                                                  </span>
                                                </div>
                                              )}
                                              <div className="mt-2 flex justify-between gap-3 border-t border-rule pt-2 font-semibold">
                                                <span>Expense total</span>
                                                <span className="font-numeric">
                                                  {currency(expense.total, group.currency)}
                                                </span>
                                              </div>
                                              <div className="flex justify-between gap-3 py-1 font-semibold">
                                                <span>{person.name}’s share</span>
                                                <span className="font-numeric">
                                                  {currency(expense.shareAmount, group.currency)}
                                                </span>
                                              </div>
                                            </div>
                                          </AnimatedDisclosure>
                                        ) : (
                                          <div className="flex min-h-11 items-center justify-between gap-3 px-5 py-3 text-sm sm:px-6">
                                            <span className="min-w-0">
                                              <span className="block break-words font-medium">
                                                {expense.name || "Untitled expense"}
                                              </span>
                                              <time
                                                className="text-xs text-ink-soft"
                                                dateTime={expense.date}
                                              >
                                                {formatExpenseDate(expense.date) ?? expense.date}
                                              </time>
                                            </span>
                                            <span className="shrink-0 text-right font-numeric text-sm">
                                              {expense.shareAmount > 0 && (
                                                <span className="block text-ink-soft">
                                                  Share{" "}
                                                  {currency(expense.shareAmount, group.currency)}
                                                </span>
                                              )}
                                              {expense.paidAmount > 0 && (
                                                <span className="block">
                                                  Paid{" "}
                                                  {currency(expense.paidAmount, group.currency)}
                                                </span>
                                              )}
                                              {expenseStatus(expense.key, person.key)}
                                            </span>
                                          </div>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                  <div className="flex flex-wrap justify-end gap-x-6 gap-y-3 border-b border-edge bg-field px-5 py-3 text-right sm:px-6">
                                    <div>
                                      <p className="text-sm text-ink-soft">Total share</p>
                                      <p className="font-numeric text-sm font-semibold">
                                        {currency(
                                          member.expenses.reduce(
                                            (sum, expense) =>
                                              sum + Math.round(expense.shareAmount * 100),
                                            0,
                                          ) / 100,
                                          group.currency,
                                        )}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-sm text-ink-soft">Total paid</p>
                                      <p className="font-numeric text-sm font-semibold">
                                        {currency(
                                          member.expenses.reduce(
                                            (sum, expense) =>
                                              sum + Math.round(expense.paidAmount * 100),
                                            0,
                                          ) / 100,
                                          group.currency,
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                            <div className="min-w-0">
                              <h3 className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-soft sm:px-6">
                                Who owes whom
                              </h3>
                              {settlements.length === 0 ? (
                                <p className="border-y border-edge bg-field px-5 py-4 text-sm text-ink-soft sm:px-6">
                                  No outstanding balance.
                                </p>
                              ) : (
                                <ul className="divide-y divide-rule border-y border-edge bg-field">
                                  {settlements.map((entry) => (
                                    <li
                                      key={`${entry.from}-${entry.to}`}
                                      className="flex min-h-11 items-center justify-between gap-3 px-5 py-3 text-sm sm:px-6"
                                    >
                                      <span>
                                        <span className="font-semibold text-margin-red-ink">
                                          {memberName(entry.from)}
                                        </span>{" "}
                                        owes{" "}
                                        <span className="font-semibold text-ledger-green">
                                          {memberName(entry.to)}
                                        </span>
                                      </span>
                                      <span className="shrink-0 font-numeric font-semibold">
                                        {currency(entry.amount, group.currency)}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        </section>
                      ))}
                    </div>
                  </AnimatedDisclosure>
                </Panel>
              );
            })}
          </div>
        ) : (
          <Panel className="p-0">
            <div className="px-5 py-4 sm:px-6">
              <SectionTitle>Payment history</SectionTitle>
              <p className="mt-1 text-sm text-ink-soft">
                {data.history.length} recorded {data.history.length === 1 ? "payment" : "payments"}.
              </p>
            </div>
            {data.history.length === 0 ? (
              <p className="border-t border-rule px-5 py-8 text-sm text-ink-soft sm:px-6">
                No payments recorded.
              </p>
            ) : (
              <ul className="bg-field">
                {[...historyByDate].map(([date, payments]) => {
                  const currencyGroups = [
                    ...payments.reduce<Map<string, typeof payments>>((groups, payment) => {
                      const group = groups.get(payment.currency) ?? [];
                      group.push(payment);
                      groups.set(payment.currency, group);
                      return groups;
                    }, new Map()),
                  ];
                  return (
                    <li key={date}>
                      <h3 className="border-b border-rule bg-surface px-5 py-2 text-sm font-semibold sm:px-6">
                        <time dateTime={date}>{formatExpenseDate(date) ?? date}</time>
                      </h3>
                      <ul>
                        {currencyGroups.map(([currencyCode, currencyPayments], groupIndex) => (
                          <li
                            key={currencyCode}
                            className={groupIndex > 0 ? "border-t border-rule" : ""}
                          >
                            <div className="flex bg-surface px-5 py-2 sm:px-6">
                              <span className="inline-flex rounded-full border border-rule bg-chip-neutral px-3 py-1 font-numeric text-xs font-semibold text-ink">
                                {currencyCode}
                              </span>
                            </div>
                            <ul
                              className={`divide-y divide-rule bg-field ${groupIndex === 0 ? "border-t border-edge" : ""} ${groupIndex === currencyGroups.length - 1 ? "border-b border-edge" : ""}`}
                            >
                              {currencyPayments.map((payment) => (
                                <li
                                  key={payment.key}
                                  className="flex min-w-0 items-center gap-3 px-5 py-3 sm:px-6"
                                >
                                  {payment.isReversal ? (
                                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-margin-red-ink">
                                      <Undo2 aria-hidden="true" className="size-5" />
                                    </span>
                                  ) : (
                                    <MemberAvatar
                                      id={payment.fromMemberId ?? payment.from}
                                      name={payment.from}
                                      size="md"
                                    />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="break-words text-sm">
                                      <span className="font-medium">
                                        {payment.isReversal ? payment.to : payment.from}
                                      </span>{" "}
                                      {payment.isReversal ? "reversed payment to" : "paid"}{" "}
                                      <span className="font-medium">
                                        {payment.isReversal ? payment.from : payment.to}
                                      </span>
                                    </p>
                                    {(payment.reversed || payment.isReversal) && (
                                      <p className="mt-1 text-xs text-ink-soft">
                                        {payment.isReversal ? "Reversal" : "Reversed"}
                                      </p>
                                    )}
                                    {payment.note && (
                                      <p className="mt-1 break-words text-xs text-ink-soft">
                                        {payment.note}
                                      </p>
                                    )}
                                  </div>
                                  <span
                                    className={`shrink-0 font-numeric text-sm font-semibold ${payment.isReversal ? "text-margin-red-ink" : "text-ink"}`}
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
        )}
      </SegmentedTabs>
    </Page>
  );
}
