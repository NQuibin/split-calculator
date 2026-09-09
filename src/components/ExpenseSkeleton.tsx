import { Skeleton } from "@/components/ui/Skeleton";

export function ExpenseSkeleton() {
  return (
    <main aria-busy="true" aria-label="Loading expense" className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-8 md:px-10 md:py-12">
      <span role="status" className="sr-only">Loading expense…</span>
      <div aria-hidden="true">
        <Skeleton className="mb-6 h-5 w-48 max-w-full" />
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-9 w-48 max-w-full" />
            <Skeleton className="mt-3 h-6 w-32" />
            <Skeleton className="mt-2 h-5 w-80 max-w-full" />
          </div>
          <Skeleton className="h-11 w-11 rounded-lg sm:w-36" />
        </div>
        <div className="rounded-xl border border-rule/70 bg-surface/80 p-5 sm:p-6">
          <div className="mb-5 flex gap-2 border-b border-rule pb-4">
            <Skeleton className="h-11 flex-1 rounded-md" />
            <Skeleton className="h-11 flex-1 rounded-md" />
          </div>
          <div className="mb-5 border-b border-rule pb-5">
            <div className="flex flex-wrap gap-3">
              <Skeleton className="h-11 w-44 max-w-full" />
              <Skeleton className="h-11 w-28" />
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2 md:gap-6">
            <div className="min-w-0">
              <Skeleton className="mb-2 h-5 w-28" />
              <Skeleton className="h-16 w-full rounded-md" />
            </div>
            <div className="border-t border-rule pt-5 md:border-t-0 md:border-l md:pt-0 md:pl-6">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="mt-2 h-4 w-32" />
              <Skeleton className="mt-3 h-14 w-full" />
            </div>
          </div>
          {[0, 1, 2].map(row => <Skeleton key={row} className="mt-4 h-12 w-full rounded-md" />)}
          <div className="mt-6 flex flex-col-reverse gap-2 border-t border-rule pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-11 w-full sm:w-16" />
            <Skeleton className="h-12 w-full rounded-lg sm:w-40" />
          </div>
        </div>
      </div>
    </main>
  );
}
