import { ArrowLeft, ArrowUpRight, FileText, Pencil, Trash2, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/Dialog";
import { MemberAvatar } from "@/components/MemberAvatar";
import { Input, Label } from "@/components/ui/Input";
import { GroupTitle } from "@/components/ui/Typography";
import { computeSplit, hasIndividualAdjustments, round2 } from "@/lib/calculations";
import { isUpcoming } from "@/lib/format";
import { useLocaleFormatters } from "@/lib/localeFormatters";
import { useTabActions, type TabExpenseSummary } from "@/lib/tabSync";
import { useState } from "react";

type Member = { id: string; name: string; resolvedId?: string };

export function ExpenseDetailsDialog({
  open,
  onOpenChange,
  expense,
  slug,
  defaultCurrency,
  canManage,
  members,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: TabExpenseSummary | undefined;
  slug: string;
  defaultCurrency: string;
  canManage: boolean;
  members: Member[];
  onDelete?: (slug: string) => void;
}) {
  const { currency, formatExpenseDate } = useLocaleFormatters();
  const split = expense
    ? computeSplit(expense.people, expense.items, expense.globalAdjustments)
    : null;
  const sharedPeople = split?.people.filter((person) => Math.round(person.total * 100) !== 0) ?? [];
  const [itemViewExpenseSlug, setItemViewExpenseSlug] = useState<string | null>(null);
  const showingItems = expense?.slug === itemViewExpenseSlug;
  const payerFor = (payerId: string | undefined) =>
    members.find((member) => member.id === payerId || member.resolvedId === payerId);
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setItemViewExpenseSlug(null);
        onOpenChange(nextOpen);
      }}
    >
      {expense && split && (
        <DialogContent
          key={expense.slug}
          aria-label={showingItems ? "Item details for this expense" : "Expense details"}
          className="flex max-h-[calc(100dvh-5rem)] flex-col overflow-hidden p-0 sm:p-0"
        >
          <header
            className={`shrink-0 border-b bg-surface p-5 sm:p-6 ${showingItems ? "border-edge" : "border-rule/70"}`}
          >
            <div className="flex items-center justify-between gap-3">
              {showingItems && (
                <Button
                  type="button"
                  variant="quiet-icon"
                  size="icon-touch"
                  aria-label="Back to expense details"
                  onClick={() => setItemViewExpenseSlug(null)}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              )}
              <div className="min-w-0 flex-1">
                <DialogTitle>{expense.name ?? "Untitled expense"}</DialogTitle>
                {showingItems && (
                  <p className="mt-1 text-sm text-ink-soft">
                    {expense.currency} · {split.items.length}{" "}
                    {split.items.length === 1 ? "item" : "items"}
                  </p>
                )}
              </div>
              <DialogClose
                aria-label="Close expense details"
                render={<Button variant="ghost" size="icon-touch" className="text-ink-soft" />}
              >
                <X className="h-5 w-5" />
              </DialogClose>
            </div>
          </header>
          {showingItems ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <ul>
                  {split.items.map((item) => {
                    const original = expense.items.find((entry) => entry.id === item.itemId);
                    const adjustments =
                      original &&
                      (hasIndividualAdjustments(original) ? original : expense.globalAdjustments);
                    const adjustmentDetail = (kind: "discount" | "tax" | "tip") => {
                      const setting = adjustments?.[kind];
                      if (!setting) return "";
                      return setting.mode === "percent"
                        ? ` · ${setting.value}%`
                        : original && hasIndividualAdjustments(original)
                          ? " · fixed"
                          : " · allocated";
                    };
                    const shares = split.people.flatMap((person) => {
                      const line = person.lines.find((entry) => entry.itemId === item.itemId);
                      return line
                        ? [{ person, amount: round2(line.share + line.taxShare + line.tipShare) }]
                        : [];
                    });
                    return (
                      <li key={item.itemId} className="border-b border-edge">
                        <div className="flex justify-between gap-3 px-5 pt-4 text-sm font-semibold sm:px-6">
                          <span className="min-w-0 break-words">{item.itemName}</span>
                          <span className="shrink-0 font-numeric">
                            {currency(item.cost, expense.currency)}
                          </span>
                        </div>
                        <div className="px-5 py-2 text-xs text-ink-soft sm:px-6">
                          {item.discountAmount > 0 && (
                            <div className="flex justify-between gap-3 py-1">
                              <span>
                                Discount
                                {adjustmentDetail("discount")}
                              </span>
                              <span className="shrink-0 font-numeric">
                                −{currency(item.cost - item.netCost, expense.currency)}
                              </span>
                            </div>
                          )}
                          {item.taxAmount > 0 && (
                            <div className="flex justify-between gap-3 py-1">
                              <span>
                                Tax
                                {adjustmentDetail("tax")}
                              </span>
                              <span className="shrink-0 font-numeric">
                                +{currency(item.taxAmount, expense.currency)}
                              </span>
                            </div>
                          )}
                          {item.tipAmount > 0 && (
                            <div className="flex justify-between gap-3 py-1">
                              <span>
                                Tip
                                {adjustmentDetail("tip")}
                              </span>
                              <span className="shrink-0 font-numeric">
                                +{currency(item.tipAmount, expense.currency)}
                              </span>
                            </div>
                          )}
                        </div>
                        <ul className="border-y border-rule bg-field px-5 py-2 sm:px-6">
                          {shares.map(({ person, amount }) => (
                            <li
                              key={person.personId}
                              className="flex min-h-8 items-center justify-between gap-3 py-1 text-sm"
                            >
                              <span className="flex min-w-0 items-center gap-3">
                                <MemberAvatar id={person.personId} name={person.name} />
                                <span className="min-w-0 break-words">{person.name}</span>
                              </span>
                              <span className="shrink-0 font-numeric">
                                {currency(amount, expense.currency)}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <div className="flex justify-between gap-3 px-5 py-3 text-sm font-semibold sm:px-6">
                          <span>Item total</span>
                          <span className="font-numeric">
                            {currency(item.total, expense.currency)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <footer className="flex shrink-0 justify-between gap-3 border-t border-rule/70 bg-surface px-5 py-4 text-sm font-semibold sm:px-6">
                <span>Expense total</span>
                <span className="font-numeric">{currency(split.grandTotal, expense.currency)}</span>
              </footer>
            </>
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto card-inset">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-numeric text-2xl font-semibold">
                      {currency(split.grandTotal, expense.currency)}
                    </p>
                    <p className="mt-1 text-sm text-ink-soft">
                      {expense.currency}
                      {expense.mode === "itemized" && (
                        <>
                          {" "}
                          · {expense.items.length} {expense.items.length === 1 ? "item" : "items"}
                        </>
                      )}
                    </p>
                  </div>
                  {expense.mode === "itemized" && (
                    <Button
                      type="button"
                      variant="link"
                      size="touch"
                      className="px-0"
                      onClick={() => setItemViewExpenseSlug(expense.slug)}
                    >
                      View items
                    </Button>
                  )}
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 text-sm text-ink-soft">
                  {formatExpenseDate(expense.date) ? (
                    <time dateTime={expense.date}>{formatExpenseDate(expense.date)}</time>
                  ) : (
                    <span>Not set</span>
                  )}
                  <span aria-hidden="true" className="h-5 border-l border-rule" />
                  <span className="inline-flex items-center gap-2">
                    <span>{isUpcoming(expense.date) ? "Planned payer" : "Paid by"}</span>
                    {payerFor(expense.payerId) && (
                      <MemberAvatar
                        id={payerFor(expense.payerId)!.id}
                        name={payerFor(expense.payerId)!.name}
                      />
                    )}
                    <span className="text-ink">
                      {payerFor(expense.payerId)?.name ??
                        (isUpcoming(expense.date) ? "Not set" : "Payer needed")}
                    </span>
                  </span>
                </div>
                <section className="mt-5">
                  <div className="bleed flex items-center justify-between gap-3 border-t border-edge pt-5 bleed-px">
                    <GroupTitle as="h3">Shared with</GroupTitle>
                    <span className="text-sm font-medium text-ink-soft">
                      {sharedPeople.length} {sharedPeople.length === 1 ? "person" : "people"}
                    </span>
                  </div>
                  <ul className="bleed mt-5 divide-y divide-rule border-b border-edge bg-field">
                    {sharedPeople.map((person) => (
                      <li
                        key={person.personId}
                        className="flex min-h-11 items-center gap-3 py-3 text-sm bleed-px"
                      >
                        <MemberAvatar id={person.personId} name={person.name} size="md" />
                        <span className="min-w-0 flex-1 break-words">
                          <span className="block font-medium">{person.name}</span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block font-numeric font-semibold">
                            {currency(person.total, expense.currency)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
                {expense.note && (
                  <section className="mt-5">
                    <GroupTitle as="h4">Note</GroupTitle>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm text-ink-soft">
                      {expense.note}
                    </p>
                  </section>
                )}
                {expense.image && (
                  <section className="mt-5 border-t border-rule/70 pt-5">
                    <GroupTitle as="h4">Receipt</GroupTitle>
                    {expense.image.url ? (
                      <a
                        href={expense.image.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 flex items-center gap-3 rounded-lg border border-rule/70 p-3 text-sm text-forest transition hover:bg-wash active:bg-wash focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                      >
                        {expense.image.type !== "application/pdf" ? (
                          <img
                            src={expense.image.url}
                            alt=""
                            className="h-12 w-12 shrink-0 rounded-md border border-rule/70 object-cover"
                          />
                        ) : (
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-paper">
                            <FileText className="h-5 w-5" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block break-words">{expense.image.name}</span>
                          <span className="mt-0.5 block text-xs text-ink-soft">
                            {expense.image.type === "application/pdf"
                              ? "PDF receipt"
                              : "Receipt image"}
                          </span>
                        </span>
                        <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" />
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    ) : (
                      <p className="mt-2 text-sm text-ink-soft">
                        This receipt is no longer available.
                      </p>
                    )}
                  </section>
                )}
                {expense.currency !== defaultCurrency && (
                  <ExchangeRateForm
                    key={`${expense.slug}:${expense.currency}:${defaultCurrency}:${expense.exchangeRate?.rate ?? "none"}`}
                    tabSlug={slug}
                    expense={expense}
                    target={defaultCurrency}
                    canEdit={canManage}
                  />
                )}
                <p className="mt-5 flex flex-wrap items-center gap-x-1 text-xs text-ink-soft">
                  <span>Created by</span>
                  <span className="text-ink">{expense.createdBy.name}</span>
                </p>
              </div>
              <footer className="shrink-0 border-t border-rule/70 bg-surface px-5 py-4 sm:px-6">
                {canManage ? (
                  <div className="grid w-full gap-3 sm:flex sm:justify-end">
                    <Button
                      variant="secondary"
                      size="touch"
                      nativeButton={false}
                      className="w-full sm:w-auto"
                      render={<Link to="/e/$slug" params={{ slug: expense.slug }} />}
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                    {onDelete && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="touch"
                        className="w-full sm:w-auto"
                        onClick={() => onDelete(expense.slug)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    )}
                  </div>
                ) : (
                  <DialogClose render={<Button variant="secondary" size="touch" />}>
                    Done
                  </DialogClose>
                )}
              </footer>
            </>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}

function ExchangeRateForm({
  tabSlug,
  expense,
  target,
  canEdit,
}: {
  tabSlug: string;
  expense: TabExpenseSummary;
  target: string;
  canEdit: boolean;
}) {
  const { currency } = useLocaleFormatters();
  const { setExpenseExchangeRate } = useTabActions();
  const [value, setValue] = useState(expense.exchangeRate?.rate.toString() ?? "");
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rate = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(rate) && rate > 0;
  async function save(next: number | null) {
    setPending(true);
    setError(null);
    try {
      await setExpenseExchangeRate({
        slug: tabSlug,
        expenseSlug: expense.slug,
        from: expense.currency,
        to: target,
        rate: next,
      });
      setExpanded(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the exchange rate.");
    } finally {
      setPending(false);
    }
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) void save(rate);
      }}
      className="mt-5 rounded-lg border border-rule bg-paper p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <GroupTitle as="h4">
            {expense.exchangeRate
              ? currency(
                  computeSplit(expense.people, expense.items, expense.globalAdjustments)
                    .grandTotal * expense.exchangeRate.rate,
                  target,
                )
              : `Exchange to ${target}`}
          </GroupTitle>
          <p className="mt-1 text-xs text-ink-soft">
            {expense.exchangeRate
              ? `Included in ${target} totals · 1 ${expense.currency} = ${expense.exchangeRate.rate} ${target}`
              : `No rate added. This expense stays in ${expense.currency} totals.`}
          </p>
        </div>
        {canEdit && (
          <Button
            type="button"
            variant="link"
            size="xs"
            disabled={pending}
            aria-expanded={expanded}
            aria-controls="exchange-rate-fields"
            onClick={() => setExpanded(!expanded)}
            className="h-auto shrink-0 px-0 text-xs underline-offset-4"
          >
            {expanded ? "Cancel" : expense.exchangeRate ? "Change" : "Add rate"}
          </Button>
        )}
      </div>
      {canEdit && expanded && (
        <div id="exchange-rate-fields">
          {!expense.exchangeRate && (
            <p className="mt-3 text-xs text-ink-soft">
              Add a rate to include this expense in the tab’s {target} totals.
            </p>
          )}
          <div className="mt-3">
            <Label htmlFor="expense-exchange-rate">
              Exchange rate (1 {expense.currency} = {target})
            </Label>
            <Input
              id="expense-exchange-rate"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              required
              value={value}
              disabled={pending}
              onChange={(event) => setValue(event.target.value)}
              placeholder="e.g. 1.38"
              aria-describedby="exchange-preview"
              className="font-numeric"
            />
          </div>
          <p id="exchange-preview" aria-live="polite" className="mt-2 text-xs text-ink-soft">
            {valid
              ? `Converted total: ${currency(computeSplit(expense.people, expense.items, expense.globalAdjustments).grandTotal * rate, target)}`
              : "Enter a rate greater than zero."}
          </p>
          <div className="mt-3 flex gap-3">
            <Button type="submit" size="lg" disabled={!valid || pending} aria-busy={pending}>
              {pending ? "Saving…" : "Save rate"}
            </Button>
            {expense.exchangeRate && (
              <Button
                type="button"
                variant="destructive"
                size="lg"
                disabled={pending}
                onClick={() => void save(null)}
              >
                Remove rate
              </Button>
            )}
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-margin-red-ink">
          {error}
        </p>
      )}
    </form>
  );
}
