"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, FilePlus, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { currency } from "@/lib/format";
import { computeSplit } from "@/lib/calculations";
import { suggestMemberMapping, type MemberMappingSuggestion } from "@/lib/groupMembers";
import { useReceiptList } from "@/lib/receiptSync";
import { useGroupActions, type GroupMemberSummary } from "@/lib/groupSync";

interface AssignReceiptDialogProps {
  groupSlug: string;
  members: GroupMemberSummary[];
}

export function AssignReceiptDialog({ groupSlug, members }: AssignReceiptDialogProps) {
  const [open, setOpen] = useState(false);
  const [pickedSlug, setPickedSlug] = useState<string | null>(null);
  const [mapping, setMapping] = useState<MemberMappingSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const receipts = useReceiptList();
  const eligible = useMemo(() => receipts.filter((r) => !r.state.groupId), [receipts]);
  const { assignReceipt } = useGroupActions();

  function reset() {
    setPickedSlug(null);
    setMapping([]);
    setError(null);
    setSubmitting(false);
  }

  function pick(slug: string) {
    const receipt = eligible.find((r) => r.slug === slug);
    if (!receipt) return;
    setPickedSlug(slug);
    setMapping(suggestMemberMapping(receipt.state.people, members));
  }

  async function handleConfirm() {
    if (!pickedSlug) return;
    setError(null);
    setSubmitting(true);
    try {
      await assignReceipt({
        groupSlug,
        receiptSlug: pickedSlug,
        memberMapping: mapping.map(({ personId, memberId, newMemberName }) => ({
          personId,
          memberId,
          newMemberName,
        })),
      });
      setOpen(false);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add the receipt.");
    } finally {
      setSubmitting(false);
    }
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
        Add existing receipt
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96 border border-rule bg-surface p-4">
        {!pickedSlug ? (
          <div>
            <p className="mb-3 text-sm font-medium text-ink">Pick a receipt to add</p>
            {eligible.length === 0 ? (
              <p className="text-sm text-ink-soft">No standalone receipts to add.</p>
            ) : (
              <ul className="max-h-72 space-y-1.5 overflow-y-auto">
                {eligible.map(({ slug, state }) => {
                  const total = computeSplit(state.people, state.items, state.tax, state.tip).grandTotal;
                  return (
                    <li key={slug}>
                      <button
                        type="button"
                        onClick={() => pick(slug)}
                        className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border border-rule px-3 py-2 text-left text-sm transition hover:border-forest"
                      >
                        <span className="truncate text-ink">
                          {state.people.map((p) => p.name).join(", ")}
                        </span>
                        <span className="font-numeric shrink-0 text-ink-soft">{currency(total)}</span>
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
              Pick a different receipt
            </button>
            <p className="mb-2 text-sm font-medium text-ink">Match each person to a group member</p>
            <ul className="space-y-2">
              {mapping.map((entry, i) => (
                <li key={entry.personId} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 truncate text-sm text-ink-soft">{entry.personName}</span>
                  <select
                    value={entry.memberId ?? "__new__"}
                    onChange={(e) => {
                      const value = e.target.value;
                      setMapping((prev) =>
                        prev.map((m, idx) =>
                          idx === i
                            ? value === "__new__"
                              ? { ...m, memberId: undefined, newMemberName: m.personName }
                              : { ...m, memberId: value, newMemberName: undefined }
                            : m,
                        ),
                      );
                    }}
                    className="w-full rounded-md border border-rule bg-paper px-2 py-1.5 text-sm text-ink outline-none focus-visible:border-forest"
                  >
                    <option value="__new__">Add as new member &ldquo;{entry.personName}&rdquo;</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
            {error && <p className="mt-2 text-xs text-margin-red">{error}</p>}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-forest px-3 py-2 text-sm font-semibold text-surface transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />}
              Add to group
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
