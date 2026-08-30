"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Receipt as ReceiptIcon } from "lucide-react";
import { computeSplit } from "@/lib/calculations";
import { currency } from "@/lib/format";
import {
  getReceiptListServerSnapshot,
  getReceiptListSnapshot,
  subscribeReceiptList,
  type StoredReceipt,
} from "@/lib/storage";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function peopleLabel({ people, namePeople }: StoredReceipt["state"]): string {
  if (namePeople) return people.map((p) => p.name).join(", ");
  return `${people.length} ${people.length === 1 ? "person" : "people"}`;
}

export function ExistingReceipts() {
  const router = useRouter();
  const receipts = useSyncExternalStore(
    subscribeReceiptList,
    getReceiptListSnapshot,
    getReceiptListServerSnapshot,
  );

  if (receipts.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-md px-6 pb-10">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-medium tracking-wide text-ink-soft uppercase">
        <ReceiptIcon className="h-3.5 w-3.5 text-brass" strokeWidth={2.25} />
        Continue a receipt
      </p>
      <ul className="space-y-2">
        {receipts.map(({ slug, state }) => {
          const total = computeSplit(state.people, state.items, state.tax, state.tip).grandTotal;
          return (
            <li key={slug}>
              <button
                type="button"
                onClick={() => router.push(`/r/${slug}`)}
                className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border border-rule bg-surface px-4 py-3 text-left transition hover:border-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{peopleLabel(state)}</p>
                  <p className="truncate text-xs text-ink-soft">
                    {state.items.length} {state.items.length === 1 ? "item" : "items"}
                    {state.updatedAt ? ` · ${dateFormatter.format(state.updatedAt)}` : ""}
                  </p>
                </div>
                <span className="font-numeric shrink-0 text-sm font-semibold text-ink">
                  {currency(total)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
