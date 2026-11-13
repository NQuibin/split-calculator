import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Panel } from "@/components/ui/Page";

export function Disclosure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Panel>
      <details>
        <summary className="flex min-h-11 list-none items-center justify-between gap-3 px-5 py-3 font-display text-lg font-semibold text-ink transition hover:bg-wash active:bg-wash focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest [&::-webkit-details-marker]:hidden">
          {label}
          <ChevronDown aria-hidden="true" className="size-5 shrink-0 chevron-flip" />
        </summary>
        <div className="border-t border-rule p-5 sm:p-6">{children}</div>
      </details>
    </Panel>
  );
}
