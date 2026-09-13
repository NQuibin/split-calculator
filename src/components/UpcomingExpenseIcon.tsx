import { ClockArrowUp } from "lucide-react";
import { isUpcoming } from "@/lib/format";

const iconClass = "h-4 w-4 shrink-0 text-brass";

/**
 * Marks an expense dated later than today - one that will be charged, but
 * hasn't been yet. Renders nothing for an expense that has already happened,
 * so callers can drop it in beside a date without a guard of their own.
 */
export function UpcomingExpenseIcon({ date }: { date: string | undefined }) {
  if (!isUpcoming(date)) return null;
  return (
    <ClockArrowUp
      role="img"
      aria-label="Upcoming expense"
      className={iconClass}
      strokeWidth={2.25}
    />
  );
}

/**
 * Says what the icon means, for a list that shows it without a date the
 * reader can compare against. Only worth rendering when something in that
 * list is actually upcoming - otherwise it explains an icon nobody can see.
 */
export function UpcomingExpenseLegend() {
  return (
    <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-soft">
      <ClockArrowUp aria-hidden="true" className={iconClass} strokeWidth={2.25} />
      Upcoming &middot; not charged yet
    </p>
  );
}
