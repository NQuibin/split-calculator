import { Suspense, useEffect, useMemo, useSyncExternalStore, useTransition } from "react";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { StageResults } from "@/components/StageResults";
import { decodeSharePayload } from "@/lib/shareLink";
import { useStoredExpense } from "@/lib/expenseSync";
import { Page } from "@/components/ui/Page";

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
    <Page>
      <StageResults
        people={decoded.people}
        payerId={decoded.payerId}
        date={decoded.date}
        items={decoded.items}
        globalAdjustments={decoded.globalAdjustments}
        currency={decoded.currency ?? "USD"}
        isOwner={false}
        onReset={() => startNavigation(() => { void navigate({ to: "/" }); })}
        navigating={isNavigating}
      />
    </Page>
  );
}
