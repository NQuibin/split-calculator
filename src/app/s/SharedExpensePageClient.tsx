"use client";

import { Suspense, useEffect, useMemo, useSyncExternalStore, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { StageResults } from "@/components/StageResults";
import { decodeSharePayload } from "@/lib/shareLink";
import { useStoredExpense } from "@/lib/expenseSync";

function useHasHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function SharedExpensePageClient() {
  return (
    <Suspense fallback={null}>
      <SharedExpenseContent />
    </Suspense>
  );
}

function SharedExpenseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const payload = searchParams.get("d");
  const hasHydrated = useHasHydrated();
  const decoded = useMemo(() => (payload ? decodeSharePayload(payload) : null), [payload]);
  const { state: owned } = useStoredExpense(decoded?.slug ?? "");
  const [isNavigating, startNavigation] = useTransition();

  useEffect(() => {
    if (!hasHydrated) return;
    if (!decoded) {
      router.replace("/");
      return;
    }
    if (owned) router.replace(`/e/${decoded.slug}`);
  }, [hasHydrated, decoded, owned, router]);

  if (!hasHydrated || !decoded || owned) return null;

  return (
    <main className="flex flex-1 flex-col">
      <StageResults
        people={decoded.people}
        items={decoded.items}
        contributions={decoded.contributions ?? []}
        currency={decoded.currency ?? "USD"}
        isOwner={false}
        onReset={() => startNavigation(() => router.push("/"))}
        navigating={isNavigating}
      />
    </main>
  );
}
