"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  Link2,
  Loader2,
  Receipt as ExpenseIcon,
  RotateCcw,
  Wallet,
} from "lucide-react";
import { ExpenseStub } from "@/components/ui/ExpenseStub";
import { computeSettlement, computeSplit } from "@/lib/calculations";
import { currency } from "@/lib/format";
import { encodeSharePayload } from "@/lib/shareLink";
import type { Contribution, Person, ExpenseItem } from "@/lib/types";

const collapseTransition = { duration: 0.2, ease: "easeInOut" as const };

interface DisclosureLineProps {
  label: string;
  amount: number;
  currency: string;
  discountAmount?: number;
  taxAmount?: number;
  tipAmount?: number;
}

function DisclosureLine({
  label,
  amount,
  currency: currencyCode,
  discountAmount = 0,
  taxAmount = 0,
  tipAmount = 0,
}: DisclosureLineProps) {
  const [open, setOpen] = useState(false);
  const hasBreakdown = discountAmount > 0 || taxAmount > 0 || tipAmount > 0;

  if (!hasBreakdown) {
    return (
      <li className="flex justify-between gap-3 text-ink-soft">
        <span className="truncate">{label}</span>
        <span className="font-numeric shrink-0">{currency(amount, currencyCode)}</span>
      </li>
    );
  }

  return (
    <li className="text-ink-soft">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-3 text-left"
      >
        <span className="flex min-w-0 items-center gap-1">
          <motion.span
            animate={{ rotate: open ? 90 : 0 }}
            transition={collapseTransition}
            className="shrink-0"
          >
            <ChevronRight className="h-3 w-3" strokeWidth={2.5} />
          </motion.span>
          <span className="truncate">{label}</span>
        </span>
        <span className="font-numeric shrink-0">{currency(amount, currencyCode)}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={collapseTransition}
            className="overflow-hidden"
          >
            <div className="mt-1 space-y-0.5 py-1 pl-4 text-xs">
              <div className="flex justify-between gap-3">
                <span>Item</span>
                <span className="font-numeric">{currency(amount + discountAmount, currencyCode)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between gap-3">
                  <span>Discount</span>
                  <span className="font-numeric">-{currency(discountAmount, currencyCode)}</span>
                </div>
              )}
              {taxAmount > 0 && (
                <div className="flex justify-between gap-3">
                  <span>Tax</span>
                  <span className="font-numeric">{currency(taxAmount, currencyCode)}</span>
                </div>
              )}
              {tipAmount > 0 && (
                <div className="flex justify-between gap-3">
                  <span>Tip</span>
                  <span className="font-numeric">{currency(tipAmount, currencyCode)}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

interface StageResultsProps {
  people: Person[];
  items: ExpenseItem[];
  contributions: Contribution[];
  currency: string;
  onReset: () => void;
  isOwner: boolean;
  onBack?: () => void;
  shareSlug?: string;
  navigating?: boolean;
}

export function StageResults({
  people,
  items,
  contributions,
  currency: currencyCode,
  onReset,
  isOwner,
  onBack,
  shareSlug,
  navigating = false,
}: StageResultsProps) {
  const [copied, setCopied] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const result = useMemo(() => computeSplit(people, items), [people, items]);
  const settlement = useMemo(() => computeSettlement(contributions, result), [contributions, result]);
  const hasContributions = settlement.some((s) => s.contributed !== 0);

  function handleShare() {
    if (!shareSlug) return;
    const payload = encodeSharePayload({ slug: shareSlug, people, items, contributions, currency: currencyCode });
    const basePath = window.location.pathname.replace(/\/e\/[^/]+$/, "");
    navigator.clipboard.writeText(`${window.location.origin}${basePath}/s?d=${payload}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        {isOwner ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-ink-soft transition hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
            Edit the expense
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft">
            <Eye className="h-4 w-4" strokeWidth={2.5} />
            Shared expense
          </span>
        )}
        <span className="font-display text-sm font-semibold tracking-wide text-brass uppercase">
          The split
        </span>
      </div>

      <h1 className="font-display mb-6 text-3xl font-semibold text-ink sm:text-4xl">
        Here&rsquo;s who owes what
      </h1>

      <div className="mb-6 rounded-md border border-rule bg-surface transition has-[button:hover]:border-forest">
        <button
          type="button"
          onClick={() => setExpenseOpen((o) => !o)}
          aria-expanded={expenseOpen}
          className="flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-ink"
        >
          <span className="flex items-center gap-1.5">
            <ExpenseIcon className="h-4 w-4 text-brass" strokeWidth={2.25} />
            View the full expense
          </span>
          <motion.span
            animate={{ rotate: expenseOpen ? 180 : 0 }}
            transition={collapseTransition}
            className="shrink-0"
          >
            <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {expenseOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={collapseTransition}
              className="overflow-hidden border-t border-rule"
            >
              <div className="px-4 py-3">
                <ul className="space-y-1 text-sm">
                  {result.items.map((item) => (
                    <DisclosureLine
                      key={item.itemId}
                      label={item.itemName}
                      amount={item.netCost}
                      currency={currencyCode}
                      discountAmount={item.discountAmount}
                      taxAmount={item.taxAmount}
                      tipAmount={item.tipAmount}
                    />
                  ))}
                </ul>
                <div className="mt-3 space-y-1 border-t border-dashed border-rule pt-3 text-sm">
                  <div className="flex justify-between text-ink-soft">
                    <span>Subtotal</span>
                    <span className="font-numeric">{currency(result.subtotal, currencyCode)}</span>
                  </div>
                  <div className="flex justify-between text-ink-soft">
                    <span>Tax</span>
                    <span className="font-numeric">{currency(result.taxTotal, currencyCode)}</span>
                  </div>
                  <div className="flex justify-between text-ink-soft">
                    <span>Tip</span>
                    <span className="font-numeric">{currency(result.tipTotal, currencyCode)}</span>
                  </div>
                  <div className="flex justify-between pt-1 font-display text-base font-semibold text-ink">
                    <span>Total</span>
                    <span className="font-numeric">{currency(result.grandTotal, currencyCode)}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {result.people.map((person) => (
          <ExpenseStub key={person.personId} className="ledger-margin px-5 pb-5">
            <p className="font-display pl-8 text-sm font-semibold tracking-wide text-ink-soft uppercase">
              {person.name} owes
            </p>
            <p className="font-numeric pl-8 text-4xl font-medium text-ink">
              {currency(person.total, currencyCode)}
            </p>

            <ul className="mt-4 space-y-1 border-t border-dashed border-rule pl-8 pt-3 text-sm">
              {person.lines.map((line) => (
                <DisclosureLine
                  key={line.itemId}
                  label={line.itemName}
                  amount={line.share}
                  currency={currencyCode}
                  discountAmount={line.discountShare}
                  taxAmount={line.taxShare}
                  tipAmount={line.tipShare}
                />
              ))}
              <li className="flex justify-between gap-3 text-ink-soft">
                <span>Tax &amp; tip</span>
                <span className="font-numeric shrink-0">
                  {currency(person.taxShare + person.tipShare, currencyCode)}
                </span>
              </li>
            </ul>
          </ExpenseStub>
        ))}
      </div>

      {hasContributions && (
        <div className="mt-6 rounded-md border border-rule bg-surface p-5">
          <p className="mb-3 flex items-center gap-1.5 font-display text-sm font-semibold tracking-wide text-ink uppercase">
            <Wallet className="h-4 w-4 text-brass" strokeWidth={2.25} />
            Settling up
          </p>
          <ul className="space-y-2 text-sm">
            {settlement.map((row) => (
              <li key={row.personId} className="flex items-center justify-between gap-3">
                <span className="text-ink">{row.name}</span>
                {row.balance > 0.005 ? (
                  <span className="font-numeric font-semibold text-forest">
                    Gets back {currency(row.balance, currencyCode)}
                  </span>
                ) : row.balance < -0.005 ? (
                  <span className="font-numeric font-semibold text-margin-red">
                    Still needs to front {currency(-row.balance, currencyCode)}
                  </span>
                ) : (
                  <span className="font-numeric text-ink-soft">Settled up</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 flex flex-col items-center gap-4 border-t border-rule pt-6 text-center">
        <p className="text-sm text-ink-soft">
          Expense total{" "}
          <span className="font-numeric font-semibold text-ink">{currency(result.grandTotal, currencyCode)}</span>{" "}
          — split across {people.length} {people.length === 1 ? "person" : "people"}.
        </p>
        {isOwner ? (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-forest px-5 py-2.5 font-display font-semibold text-forest transition hover:bg-forest hover:text-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                  Link copied
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4" strokeWidth={2.5} />
                  Copy share link
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onReset}
              disabled={navigating}
              aria-busy={navigating}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-forest px-5 py-2.5 font-display font-semibold text-forest transition hover:bg-forest hover:text-surface disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
            >
              {navigating ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
              ) : (
                <RotateCcw className="h-4 w-4" strokeWidth={2.5} />
              )}
              Start a new expense
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onReset}
            disabled={navigating}
            aria-busy={navigating}
            className="cursor-pointer text-sm font-medium text-forest underline decoration-forest/40 underline-offset-4 transition hover:text-ink hover:decoration-ink/40 disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
          >
            {navigating ? "Starting a new expense…" : "Want to split your own expense? Start one →"}
          </button>
        )}
      </div>
    </div>
  );
}
