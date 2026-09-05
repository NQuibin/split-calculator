"use client";

import { useState } from "react";
import { ArrowLeft, Users2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { MemberMappingForm } from "@/components/MemberMappingForm";
import { suggestMemberMapping, type MemberMappingSuggestion } from "@/lib/tabMembers";
import { useTab, useTabList } from "@/lib/tabSync";
import type { Person } from "@/lib/types";

interface AddToTabDialogProps {
  people: Person[];
  /** Left to the caller since it differs for an already-saved expense (assign right away) vs. a brand-new draft (stash the choice until the expense is first saved). */
  onConfirm: (tab: { slug: string; name: string }, mapping: MemberMappingSuggestion[]) => Promise<void>;
}

export function AddToTabDialog({ people, onConfirm }: AddToTabDialogProps) {
  const [open, setOpen] = useState(false);
  const [pickedSlug, setPickedSlug] = useState<string | null>(null);

  // Only tabs this user owns can receive an assigned expense (assignExpense
  // requires ownership), so tabs the user has merely joined are left out.
  const tabs = useTabList().filter((t) => t.isOwner);
  const pickedTab = useTab(pickedSlug ?? "");

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
            className="mx-auto mt-3 flex cursor-pointer items-center gap-1.5 text-xs font-medium text-ink-soft transition hover:text-forest"
          />
        }
      >
        <Users2 className="h-3.5 w-3.5" strokeWidth={2.25} />
        Add to a tab
      </PopoverTrigger>
      <PopoverContent align="center" className="w-80 border border-rule bg-surface p-4">
        {!pickedSlug ? (
          <div>
            <p className="mb-3 text-sm font-medium text-ink">Pick a tab</p>
            {tabs.length === 0 ? (
              <p className="text-sm text-ink-soft">You don&rsquo;t own any tabs yet.</p>
            ) : (
              <ul className="max-h-72 space-y-1.5 overflow-y-auto">
                {tabs.map((tab) => (
                  <li key={tab.slug}>
                    <button
                      type="button"
                      onClick={() => setPickedSlug(tab.slug)}
                      className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border border-rule px-3 py-2 text-left text-sm transition hover:border-forest"
                    >
                      <span className="truncate text-ink">{tab.name}</span>
                      <span className="shrink-0 text-xs text-ink-soft">
                        {tab.memberCount} {tab.memberCount === 1 ? "member" : "members"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : !pickedTab ? null : (
          <div>
            <button
              type="button"
              onClick={reset}
              className="mb-3 inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-ink-soft hover:text-forest"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
              Pick a different tab
            </button>
            <MemberMappingForm
              members={pickedTab.members}
              initialMapping={suggestMemberMapping(people, pickedTab.members)}
              confirmLabel="Add to tab"
              onConfirm={async (mapping) => {
                await onConfirm({ slug: pickedTab.slug, name: pickedTab.name }, mapping);
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
