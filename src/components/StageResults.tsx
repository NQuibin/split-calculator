"use client";

import { useMemo } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { ReceiptStub } from "@/components/ui/ReceiptStub";
import { computeSplit } from "@/lib/calculations";
import type { Person, RateSetting, ReceiptItem } from "@/lib/types";

interface StageResultsProps {
  people: Person[];
  items: ReceiptItem[];
  tax: RateSetting;
  tip: RateSetting;
  onBack: () => void;
  onReset: () => void;
}

function currency(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function StageResults({ people, items, tax, tip, onBack, onReset }: StageResultsProps) {
  const result = useMemo(() => computeSplit(people, items, tax, tip), [people, items, tax, tip]);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
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
              {person.lines.map((line) => (
                <li key={line.itemId} className="flex justify-between gap-3 text-ink-soft">
                  <span className="truncate">{line.itemName}</span>
                  <span className="font-numeric shrink-0">{currency(line.share)}</span>
                </li>
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
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-full border-2 border-forest px-5 py-2.5 font-display font-semibold text-forest transition hover:bg-forest hover:text-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
        >
          <RotateCcw className="h-4 w-4" strokeWidth={2.5} />
          Start a new receipt
        </button>
      </div>
    </div>
  );
}
