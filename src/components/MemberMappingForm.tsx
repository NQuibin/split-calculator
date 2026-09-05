"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { MemberMappingSuggestion } from "@/lib/tabMembers";

interface MemberMappingFormProps {
  members: { id: string; name: string }[];
  initialMapping: MemberMappingSuggestion[];
  confirmLabel: string;
  onConfirm: (mapping: MemberMappingSuggestion[]) => Promise<void>;
}

/** Lets each expense person be matched to an existing tab member, or added as a brand-new one. Shared by the tab page's "add existing expense" flow and the expense page's "add to a tab" flow. */
export function MemberMappingForm({ members, initialMapping, confirmLabel, onConfirm }: MemberMappingFormProps) {
  const [mapping, setMapping] = useState(initialMapping);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm(mapping);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't complete this.");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-ink">Match each person to a tab member</p>
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
        {confirmLabel}
      </button>
    </div>
  );
}
