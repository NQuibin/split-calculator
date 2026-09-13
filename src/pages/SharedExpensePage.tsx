import { Suspense, useEffect, useMemo, useTransition } from "react";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { StageResults } from "@/components/StageResults";
import { decodeSharePayload } from "@/lib/shareLink";
import { useStoredExpense } from "@/lib/expenseSync";
import { Page } from "@/components/ui/Page";

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
  const decoded = useMemo(() => (payload ? decodeSharePayload(payload) : null), [payload]);
  const { state: owned } = useStoredExpense(decoded?.slug ?? "");
  const [isNavigating, startNavigation] = useTransition();

  useEffect(() => {
    if (!decoded) {
      void navigate({ to: "/", replace: true });
      return;
    }
    if (owned) void navigate({ to: "/e/$slug", params: { slug: decoded.slug }, replace: true });
  }, [decoded, owned, navigate]);

  if (!decoded || owned) return null;

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
