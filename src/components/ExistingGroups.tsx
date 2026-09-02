"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Users2 } from "lucide-react";
import { useGroupList } from "@/lib/groupSync";

export function ExistingGroups() {
  const router = useRouter();
  const groups = useGroupList();
  const [isPending, startTransition] = useTransition();
  const [openingSlug, setOpeningSlug] = useState<string | null>(null);

  function handleOpen(slug: string) {
    setOpeningSlug(slug);
    startTransition(() => router.push(`/g/${slug}`));
  }

  if (groups.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-md px-6 pb-10">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-medium tracking-wide text-ink-soft uppercase">
        <Users2 className="h-3.5 w-3.5 text-brass" strokeWidth={2.25} />
        Your groups
      </p>
      <ul className="space-y-2">
        {groups.map(({ slug, name, memberCount }) => {
          const opening = isPending && openingSlug === slug;
          return (
            <li key={slug}>
              <button
                type="button"
                onClick={() => handleOpen(slug)}
                disabled={isPending}
                aria-busy={opening}
                className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border border-rule bg-surface px-4 py-3 text-left transition hover:border-forest disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{name}</p>
                  <p className="truncate text-xs text-ink-soft">
                    {memberCount} {memberCount === 1 ? "member" : "members"}
                  </p>
                </div>
                {opening && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink-soft" strokeWidth={2.25} />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
