"use client";

import { Suspense, useEffect, useMemo, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { StageResults } from "@/components/StageResults";
import { decodeSharePayload } from "@/lib/shareLink";
import { useStoredReceipt } from "@/lib/receiptSync";

function useHasHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export default function SharedReceiptPage() {
  return (
    <Suspense fallback={null}>
      <SharedReceiptContent />
    </Suspense>
  );
}

function SharedReceiptContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const payload = searchParams.get("d");
  const hasHydrated = useHasHydrated();
  const decoded = useMemo(() => (payload ? decodeSharePayload(payload) : null), [payload]);
  const { state: owned } = useStoredReceipt(decoded?.slug ?? "");

  useEffect(() => {
    if (!hasHydrated) return;
    if (!decoded) {
      router.replace("/");
      return;
    }
    if (owned) router.replace(`/r/${decoded.slug}`);
  }, [hasHydrated, decoded, owned, router]);

  if (!hasHydrated || !decoded || owned) return null;

  return (
    <main className="flex flex-1 flex-col">
      <StageResults
        people={decoded.people}
        items={decoded.items}
        tax={decoded.tax}
        tip={decoded.tip}
        contributions={decoded.contributions ?? []}
        isOwner={false}
        onReset={() => router.push("/")}
      />
    </main>
  );
}
