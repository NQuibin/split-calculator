import { Suspense, useEffect, useMemo, useSyncExternalStore, useTransition } from "react";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
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

const route = getRouteApi("/s");

export function SharedExpensePage() {
  return (
    <Suspense fallback={null}>
      <SharedExpenseContent />
    </Suspense>
  );
}

function SharedExpenseContent() {
  const navigate = useNavigate();
  const { d: payload } = route.useSearch();
  const hasHydrated = useHasHydrated();
  const decoded = useMemo(() => (payload ? decodeSharePayload(payload) : null), [payload]);
  const { state: owned } = useStoredExpense(decoded?.slug ?? "");
  const [isNavigating, startNavigation] = useTransition();

  useEffect(() => {
    if (!hasHydrated) return;
    if (!decoded) {
      void navigate({ to: "/", replace: true });
      return;
    }
    if (owned) void navigate({ to: "/e/$slug", params: { slug: decoded.slug }, replace: true });
  }, [hasHydrated, decoded, owned, navigate]);

  if (!hasHydrated || !decoded || owned) return null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-8 md:px-10 md:py-12">
      <StageResults
        people={decoded.people}
        items={decoded.items}
        contributions={decoded.contributions ?? []}
        currency={decoded.currency ?? "USD"}
        isOwner={false}
        onReset={() => startNavigation(() => { void navigate({ to: "/" }); })}
        navigating={isNavigating}
      />
    </main>
  );
}
