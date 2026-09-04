"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Receipt as ExpenseIcon, Trash2 } from "lucide-react";
import { computeSplit } from "@/lib/calculations";
import { currency } from "@/lib/format";
import { useExpenseActions, useExpenseList } from "@/lib/expenseSync";
import type { StoredExpense } from "@/lib/storage";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function expenseCardLabel({ name, people }: StoredExpense["state"]): string {
  if (name?.trim()) return name.trim();
  const allDefaultNamed = people.every((p, i) => p.name === `Person ${i + 1}`);
  if (!allDefaultNamed) return people.map((p) => p.name).join(", ");
  return `${people.length} ${people.length === 1 ? "person" : "people"}`;
}

export function ExistingExpenses() {
  const router = useRouter();
  const expenses = useExpenseList();
  const { remove } = useExpenseActions();
  const [isPending, startTransition] = useTransition();
  const [openingSlug, setOpeningSlug] = useState<string | null>(null);

  function handleOpen(slug: string) {
    setOpeningSlug(slug);
    startTransition(() => router.push(`/e/${slug}`));
  }

  if (expenses.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-md px-6 pb-10">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-medium tracking-wide text-ink-soft uppercase">
        <ExpenseIcon className="h-3.5 w-3.5 text-brass" strokeWidth={2.25} />
        Continue an expense
      </p>
      <ul className="space-y-2">
        {expenses.map(({ slug, state }) => {
          const total = computeSplit(state.people, state.items, state.tax, state.tip).grandTotal;
          const opening = isPending && openingSlug === slug;
          return (
            <li key={slug} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpen(slug)}
                disabled={isPending}
                aria-busy={opening}
                className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border border-rule bg-surface px-4 py-3 text-left transition hover:border-forest disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{expenseCardLabel(state)}</p>
                  <p className="truncate text-xs text-ink-soft">
                    {state.items.length} {state.items.length === 1 ? "item" : "items"}
                    {state.updatedAt ? ` · ${dateFormatter.format(state.updatedAt)}` : ""}
                  </p>
                </div>
                {opening ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink-soft" strokeWidth={2.25} />
                ) : (
                  <span className="font-numeric shrink-0 text-sm font-semibold text-ink">
                    {currency(total)}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => remove(slug)}
                disabled={isPending}
                aria-label="Delete expense"
                className="shrink-0 cursor-pointer rounded-md p-2 text-ink-soft transition hover:text-margin-red disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
              >
                <Trash2 className="h-4 w-4" strokeWidth={2.25} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
