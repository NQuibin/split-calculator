import { HatGlasses } from "lucide-react";

/**
 * Marks a tab member who hasn't claimed their seat with a real account. The
 * dashed border is the tell: the person is a placeholder, not a settled fact.
 */
export function AnonymousBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-rule px-2 py-0.5 text-xs font-medium text-ink-soft">
      <HatGlasses aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.25} />
      Anonymous
    </span>
  );
}
