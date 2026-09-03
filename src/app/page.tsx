"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Users } from "lucide-react";
import { CreateGroupMenu } from "@/components/CreateGroupMenu";
import { ExistingGroups } from "@/components/ExistingGroups";
import { ExistingReceipts } from "@/components/ExistingReceipts";
import { encodeDraftParams } from "@/lib/receiptDraft";
import { generateSlug } from "@/lib/slug";
import type { Person } from "@/lib/types";

const DEFAULT_PEOPLE: Person[] = [
  { id: "person-1", name: "Person 1" },
  { id: "person-2", name: "Person 2" },
];

export default function Home() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleStart() {
    const slug = generateSlug();
    const params = encodeDraftParams(DEFAULT_PEOPLE, true);
    startTransition(() => router.push(`/r/${slug}?${params.toString()}`));
  }

  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-8 px-6 pt-12 pb-10 text-center">
        <div className="flex items-center gap-2 text-brass">
          <Users className="h-5 w-5" strokeWidth={2.25} />
          <span className="font-display text-sm font-semibold tracking-wide uppercase">Split Calculator</span>
        </div>

        <button
          type="button"
          onClick={handleStart}
          disabled={isPending}
          aria-busy={isPending}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-forest px-6 py-3 font-display font-semibold text-surface transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
        >
          Split a receipt
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
          ) : (
            <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
          )}
        </button>
      </div>

      <ExistingReceipts />
      <ExistingGroups />
      <div className="mx-auto w-full max-w-md px-6 pb-16">
        <CreateGroupMenu />
      </div>
    </main>
  );
}
