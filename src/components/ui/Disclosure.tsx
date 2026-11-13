import type { ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";

export function Disclosure({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <details>
      <summary className="flex min-h-11 list-none items-center justify-between gap-3 px-4 py-2 font-display text-base font-semibold text-ink transition hover:bg-wash active:bg-wash focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-3">
          {Icon && <Icon aria-hidden="true" className="size-4 shrink-0 text-forest" />}
          {label}
        </span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-ink-soft chevron-flip" />
      </summary>
      <div className="px-4 pt-1 pb-4">{children}</div>
    </details>
  );
}
