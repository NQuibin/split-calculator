import { Skeleton } from "@/components/ui/skeleton";

// Shown while an expense's state is still loading (auth check, Convex query,
// or hydration). Mirrors StageExpense's markup 1:1 - same outer container,
// same borders/padding/margins on every row, and bar heights measured
// against the real rendered controls (getBoundingClientRect, not guessed
// from Tailwind's height scale) - so the real form swaps in at the exact
// same size and position with no layout shift, and the footer stays pinned
// to the bottom (via `flex-1` on <main>) instead of collapsing up.
export function ExpenseSkeleton() {
  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-28" />
        </div>

        <div className="rounded-lg border border-rule bg-surface p-5">
          <div className="mb-4 flex items-center gap-2 border-b border-rule pb-4">
            <Skeleton className="h-4 w-4 shrink-0" />
            <Skeleton className="h-5 w-9" />
            <Skeleton className="h-[34px] w-28" />
          </div>

          <div className="mb-4 flex flex-wrap gap-4 border-b border-rule pb-4">
            <Skeleton className="h-[34px] w-24" />
            <Skeleton className="h-[34px] w-24" />
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Skeleton className="h-[38px] flex-1" />
              <Skeleton className="h-[38px] w-full sm:w-28" />
            </div>

            <div>
              <Skeleton className="mb-1 h-4 w-40" />
              <Skeleton className="h-[34px] w-28" />
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Skeleton className="h-5 w-14" />
              <Skeleton className="h-5 w-14" />
            </div>

            <div>
              <Skeleton className="mb-1.5 h-4 w-20" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-9 w-20 rounded-full" />
                <Skeleton className="h-9 w-20 rounded-full" />
              </div>
            </div>

            <Skeleton className="h-9 w-36 rounded-md" />
          </div>

          <div className="perforated-top mt-4 space-y-1 pt-4">
            <div className="flex justify-between">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-12" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-5 w-10" />
              <Skeleton className="h-5 w-12" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-5 w-8" />
              <Skeleton className="h-5 w-12" />
            </div>
            <div className="flex justify-between pt-1">
              <Skeleton className="h-6 w-12" />
              <Skeleton className="h-6 w-16" />
            </div>
          </div>

          <div className="mt-4 rounded-md border border-rule">
            <Skeleton className="h-11 w-full" />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Skeleton className="h-12 w-44 rounded-full" />
        </div>
      </div>
    </main>
  );
}
