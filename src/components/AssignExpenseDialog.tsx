"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, FilePlus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { MemberMappingForm } from "@/components/MemberMappingForm";
import { currency } from "@/lib/format";
import { computeSplit } from "@/lib/calculations";
import { suggestMemberMapping } from "@/lib/tabMembers";
import { useExpenseList } from "@/lib/expenseSync";
import { useTabActions, type TabMemberSummary } from "@/lib/tabSync";

interface AssignExpenseDialogProps {
  tabSlug: string;
  members: TabMemberSummary[];
}

export function AssignExpenseDialog({ tabSlug, members }: AssignExpenseDialogProps) {
  const [open, setOpen] = useState(false);
  const [pickedSlug, setPickedSlug] = useState<string | null>(null);

  const expenses = useExpenseList();
  const eligible = useMemo(() => expenses.filter((r) => !r.state.tabId), [expenses]);
  const { assignExpense } = useTabActions();

  const pickedExpense = pickedSlug ? eligible.find((r) => r.slug === pickedSlug) : undefined;

  function reset() {
    setPickedSlug(null);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-rule bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:border-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
          />
        }
      >
        <FilePlus className="h-3.5 w-3.5" strokeWidth={2.25} />
        Add existing expense
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96 border border-rule bg-surface p-4">
        {!pickedExpense ? (
          <div>
            <p className="mb-3 text-sm font-medium text-ink">Pick an expense to add</p>
            {eligible.length === 0 ? (
              <p className="text-sm text-ink-soft">No standalone expenses to add.</p>
            ) : (
              <ul className="max-h-72 space-y-1.5 overflow-y-auto">
                {eligible.map(({ slug, state }) => {
                  const total = computeSplit(state.people, state.items).grandTotal;
                  return (
                    <li key={slug}>
                      <button
                        type="button"
                        onClick={() => setPickedSlug(slug)}
                        className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border border-rule px-3 py-2 text-left text-sm transition hover:border-forest"
                      >
                        <span className="truncate text-ink">{state.name}</span>
                        <span className="font-numeric shrink-0 text-ink-soft">{currency(total, state.currency)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={reset}
              className="mb-3 inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-ink-soft hover:text-forest"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
              Pick a different expense
            </button>
            <MemberMappingForm
              members={members}
              initialMapping={suggestMemberMapping(pickedExpense.state.people, members)}
              confirmLabel="Add to tab"
              onConfirm={async (mapping) => {
                await assignExpense({
                  tabSlug,
                  expenseSlug: pickedExpense.slug,
                  memberMapping: mapping.map(({ personId, memberId, newMemberName }) => ({
                    personId,
                    memberId,
                    newMemberName,
                  })),
                });
                setOpen(false);
                reset();
              }}
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
