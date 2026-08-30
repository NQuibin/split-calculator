"use client";

import { useMemo } from "react";
import { ArrowLeft, ChevronRight, RotateCcw } from "lucide-react";
import { ReceiptStub } from "@/components/ui/ReceiptStub";
import { computeSplit } from "@/lib/calculations";
import { currency } from "@/lib/format";
import type { Person, RateSetting, ReceiptItem } from "@/lib/types";

interface StageResultsProps {
  people: Person[];
  items: ReceiptItem[];
  tax: RateSetting;
  tip: RateSetting;
  onBack: () => void;
  onReset: () => void;
}

export function StageResults({ people, items, tax, tip, onBack, onReset }: StageResultsProps) {
  const result = useMemo(() => computeSplit(people, items, tax, tip), [people, items, tax, tip]);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-ink-soft transition hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
          Edit the receipt
        </button>
        <span className="font-display text-sm font-semibold tracking-wide text-brass uppercase">
          The split
        </span>
      </div>

      <h1 className="font-display mb-6 text-3xl font-semibold text-ink sm:text-4xl">
        Here&rsquo;s who owes what
      </h1>

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
              {person.lines.map((line) => {
                const hasBreakdown = line.taxShare > 0 || line.tipShare > 0 || line.discountShare > 0;

                if (!hasBreakdown) {
                  return (
                    <li key={line.itemId} className="flex justify-between gap-3 text-ink-soft">
                      <span className="truncate">{line.itemName}</span>
                      <span className="font-numeric shrink-0">{currency(line.share)}</span>
                    </li>
                  );
                }

                return (
                  <li key={line.itemId} className="text-ink-soft">
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                        <span className="flex min-w-0 items-center gap-1">
                          <ChevronRight
                            className="h-3 w-3 shrink-0 transition group-open:rotate-90"
                            strokeWidth={2.5}
                          />
                          <span className="truncate">{line.itemName}</span>
                        </span>
                        <span className="font-numeric shrink-0">{currency(line.share)}</span>
                      </summary>
                      <div className="mt-1 space-y-0.5 py-1 pl-4 text-xs">
                        <div className="flex justify-between gap-3">
                          <span>Item</span>
                          <span className="font-numeric">
                            {currency(line.share + line.discountShare)}
                          </span>
                        </div>
                        {line.discountShare > 0 && (
                          <div className="flex justify-between gap-3">
                            <span>Discount</span>
                            <span className="font-numeric">-{currency(line.discountShare)}</span>
                          </div>
                        )}
                        {line.taxShare > 0 && (
                          <div className="flex justify-between gap-3">
                            <span>Tax</span>
                            <span className="font-numeric">{currency(line.taxShare)}</span>
                          </div>
                        )}
                        {line.tipShare > 0 && (
                          <div className="flex justify-between gap-3">
                            <span>Tip</span>
                            <span className="font-numeric">{currency(line.tipShare)}</span>
                          </div>
                        )}
                      </div>
                    </details>
                  </li>
                );
              })}
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
        <button
          type="button"
          onClick={onReset}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-forest px-5 py-2.5 font-display font-semibold text-forest transition hover:bg-forest hover:text-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
        >
          <RotateCcw className="h-4 w-4" strokeWidth={2.5} />
          Start a new receipt
        </button>
      </div>
    </div>
  );
}
