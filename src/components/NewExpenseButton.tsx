"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { ArrowRight, Loader2 } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { encodeDraftParams } from "@/lib/expenseDraft";
import { generateSlug } from "@/lib/slug";
import type { Person } from "@/lib/types";

const defaultClass =
  "inline-flex cursor-pointer items-center gap-2 rounded-full bg-forest px-6 py-3 font-display font-semibold text-surface transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red";

export function NewExpenseButton({ className }: { className?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const viewer = useQuery(api.users.viewer);

  function handleStart() {
    const slug = generateSlug();
    // The signed-in starter keeps their real user id so this person stays
    // linked to their account (see expenseDraft.ts's `uid` param).
    const people: Person[] = viewer
      ? [{ id: viewer._id, name: viewer.name ?? viewer.email ?? "Person 1" }, { id: "person-2", name: "Person 2" }]
      : [
          { id: "person-1", name: "Person 1" },
          { id: "person-2", name: "Person 2" },
        ];
    const params = encodeDraftParams(people, true, viewer?._id);
    startTransition(() => router.push(`/e/${slug}?${params.toString()}`));
  }

  return (
    <button
      type="button"
      onClick={handleStart}
      disabled={isPending}
      aria-busy={isPending}
      className={className ?? defaultClass}
    >
      Split an expense
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
      ) : (
        <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
      )}
    </button>
  );
}
