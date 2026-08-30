"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check, ChevronDown, ChevronRight, Eye, Link2, Receipt as ReceiptIcon, RotateCcw } from "lucide-react";
import { ReceiptStub } from "@/components/ui/ReceiptStub";
import { computeSplit } from "@/lib/calculations";
import { currency } from "@/lib/format";
import { encodeSharePayload } from "@/lib/shareLink";
import type { Person, RateSetting, ReceiptItem } from "@/lib/types";

const collapseTransition = { duration: 0.2, ease: "easeInOut" as const };

interface DisclosureLineProps {
  label: string;
  amount: number;
  discountAmount?: number;
  taxAmount?: number;
  tipAmount?: number;
}

function DisclosureLine({
  label,
  amount,
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
        <span className="font-numeric shrink-0">{currency(amount)}</span>
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
        <span className="font-numeric shrink-0">{currency(amount)}</span>
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
                <span className="font-numeric">{currency(amount + discountAmount)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between gap-3">
                  <span>Discount</span>
                  <span className="font-numeric">-{currency(discountAmount)}</span>
                </div>
              )}
              {taxAmount > 0 && (
                <div className="flex justify-between gap-3">
                  <span>Tax</span>
                  <span className="font-numeric">{currency(taxAmount)}</span>
                </div>
              )}
              {tipAmount > 0 && (
                <div className="flex justify-between gap-3">
                  <span>Tip</span>
                  <span className="font-numeric">{currency(tipAmount)}</span>
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
  items: ReceiptItem[];
  tax: RateSetting;
  tip: RateSetting;
  onReset: () => void;
  isOwner: boolean;
  onBack?: () => void;
  shareSlug?: string;
}

export function StageResults({
  people,
  items,
  tax,
  tip,
  onReset,
  isOwner,
  onBack,
  shareSlug,
}: StageResultsProps) {
  const [copied, setCopied] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const result = useMemo(() => computeSplit(people, items, tax, tip), [people, items, tax, tip]);

  function handleShare() {
    if (!shareSlug) return;
    const payload = encodeSharePayload({ slug: shareSlug, people, items, tax, tip });
    const basePath = window.location.pathname.replace(/\/r\/[^/]+$/, "");
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
            Edit the receipt
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft">
            <Eye className="h-4 w-4" strokeWidth={2.5} />
            Shared receipt
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
          onClick={() => setReceiptOpen((o) => !o)}
          aria-expanded={receiptOpen}
          className="flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-ink"
        >
          <span className="flex items-center gap-1.5">
            <ReceiptIcon className="h-4 w-4 text-brass" strokeWidth={2.25} />
            View the full receipt
          </span>
          <motion.span
            animate={{ rotate: receiptOpen ? 180 : 0 }}
            transition={collapseTransition}
            className="shrink-0"
          >
            <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {receiptOpen && (
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
                      discountAmount={item.discountAmount}
                      taxAmount={item.taxAmount}
                      tipAmount={item.tipAmount}
                    />
                  ))}
                </ul>
                <div className="mt-3 space-y-1 border-t border-dashed border-rule pt-3 text-sm">
                  <div className="flex justify-between text-ink-soft">
                    <span>Subtotal</span>
                    <span className="font-numeric">{currency(result.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-ink-soft">
                    <span>Tax</span>
                    <span className="font-numeric">{currency(result.taxTotal)}</span>
                  </div>
                  <div className="flex justify-between text-ink-soft">
                    <span>Tip</span>
                    <span className="font-numeric">{currency(result.tipTotal)}</span>
                  </div>
                  <div className="flex justify-between pt-1 font-display text-base font-semibold text-ink">
                    <span>Total</span>
                    <span className="font-numeric">{currency(result.grandTotal)}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {result.people.map((person) => (
          <ReceiptStub key={person.personId} className="ledger-margin px-5 pb-5">
            <p className="font-display pl-8 text-sm font-semibold tracking-wide text-ink-soft uppercase">
              {person.name} owes
            </p>
            <p className="font-numeric pl-8 text-4xl font-medium text-ink">
              {currency(person.total)}
            </p>

            <ul className="mt-4 space-y-1 border-t border-dashed border-rule pl-8 pt-3 text-sm">
              {person.lines.map((line) => (
                <DisclosureLine
                  key={line.itemId}
                  label={line.itemName}
                  amount={line.share}
                  discountAmount={line.discountShare}
                  taxAmount={line.taxShare}
                  tipAmount={line.tipShare}
                />
              ))}
              <li className="flex justify-between gap-3 text-ink-soft">
                <span>Tax &amp; tip</span>
                <span className="font-numeric shrink-0">
                  {currency(person.taxShare + person.tipShare)}
                </span>
              </li>
            </ul>
          </ReceiptStub>
        ))}
      </div>

      <div className="mt-8 flex flex-col items-center gap-4 border-t border-rule pt-6 text-center">
        <p className="text-sm text-ink-soft">
          Receipt total{" "}
          <span className="font-numeric font-semibold text-ink">{currency(result.grandTotal)}</span>{" "}
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
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-forest px-5 py-2.5 font-display font-semibold text-forest transition hover:bg-forest hover:text-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
            >
              <RotateCcw className="h-4 w-4" strokeWidth={2.5} />
              Start a new receipt
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onReset}
            className="cursor-pointer text-sm font-medium text-forest underline decoration-forest/40 underline-offset-4 transition hover:text-ink hover:decoration-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
          >
            Want to split your own receipt? Start one →
          </button>
        )}
      </div>
    </div>
  );
}
