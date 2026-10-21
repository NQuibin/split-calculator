import { CircleCheck } from "lucide-react";

import { CurrencyPill } from "@/components/ui/CurrencyPill";

export function SettledBalanceRow({ currencyCode }: { currencyCode: string }) {
  return (
    <div className="flex min-h-16 items-center gap-3 border-y border-rule bg-field py-4 bleed-px">
      <CircleCheck aria-hidden="true" className="h-5 w-5 shrink-0 text-forest" />
      <p className="min-w-0 text-sm text-ink">No outstanding balances</p>
      <span className="ml-auto shrink-0">
        <CurrencyPill code={currencyCode} />
      </span>
    </div>
  );
}
