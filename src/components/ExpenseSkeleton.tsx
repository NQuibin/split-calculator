import { Skeleton } from "@/components/ui/Skeleton";

// Match the editor's page shell and panels while account and expense data load.
export function ExpenseSkeleton() {
  return (
    <main aria-busy="true" aria-label="Loading expense" className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-8 md:px-10 md:py-12">
      <span role="status" className="sr-only">Loading expense…</span>
      <div aria-hidden="true">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-7 w-32 rounded-full" />
        </div>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-9 w-48 max-w-full" />
            <Skeleton className="mt-2 h-5 w-80 max-w-full" />
          </div>
          <Skeleton className="h-11 w-36 rounded-lg" />
        </div>
        <div className="mb-5 rounded-xl border border-rule/70 bg-surface/80 p-5 sm:p-6">
          <Skeleton className="mb-3 h-5 w-24" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-10 w-28 rounded-full" />
            <Skeleton className="h-10 w-28 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-9 w-32 rounded-full" />
        </div>
        <div className="rounded-xl border border-rule/70 bg-surface/80 p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-rule pb-4">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-9 w-40" />
          </div>
          <div className="mb-4 flex gap-2 border-b border-rule pb-4">
            <Skeleton className="h-10 flex-1 rounded-md" />
            <Skeleton className="h-10 flex-1 rounded-md" />
          </div>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-10 min-w-32 flex-1" />
              <Skeleton className="h-10 w-28" />
            </div>
            <div><Skeleton className="mb-2 h-4 w-44" /><Skeleton className="h-9 w-40" /></div>
            <div className="flex flex-wrap gap-6"><Skeleton className="h-9 w-48" /><Skeleton className="h-9 w-48" /></div>
            <Skeleton className="h-10 w-28 rounded-lg" />
          </div>
          <div className="perforated-top mt-5 space-y-3 pt-4">
            {[0, 1].map(row => <div key={row} className="flex justify-between gap-4"><Skeleton className="h-6 w-40" /><Skeleton className="h-6 w-24" /></div>)}
          </div>
          <div className="perforated-top mt-4 space-y-2 pt-4">
            {[0, 1, 2, 3].map(row => <div key={row} className="flex justify-between gap-4"><Skeleton className="h-5 w-20" /><Skeleton className="h-5 w-24" /></div>)}
          </div>
          <Skeleton className="mt-4 h-12 w-full rounded-md" />
          <Skeleton className="mt-4 h-11 w-full rounded-lg" />
          <Skeleton className="mt-4 h-11 w-full rounded-lg" />
          <div className="mt-6 flex items-center justify-between gap-3">
            <Skeleton className="h-5 w-14" />
            <Skeleton className="h-12 w-40 rounded-lg" />
          </div>
        </div>
      </div>
    </main>
  );
}
