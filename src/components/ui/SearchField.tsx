import type { ComponentProps } from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A filter box with a leading magnifier. The `<label>` carries the field ground
 * so the whole box — icon included — lights up on focus, which a ring on the
 * bare `<input>` can't do.
 *
 * There is no visible label, so `aria-label` is required rather than optional
 * (DESIGN.md § 5 Inputs: a placeholder is never the only label).
 */
interface SearchFieldProps extends ComponentProps<"input"> {
  "aria-label": string;
  /** Layout only — width, flex behaviour, outer margin. Not field styling. */
  className?: string;
}

export function SearchField({ className, ...props }: SearchFieldProps) {
  return (
    <label
      className={cn(
        // No `w-full`: `flex` already makes this a block-level box that fills
        // its parent, and an explicit width would force a wrap for any caller
        // sitting in a `flex-wrap` row without a `flex-1` of its own.
        "flex min-h-11 min-w-0 items-center gap-2 rounded-md border border-edge bg-field px-3 py-2 transition focus-within:border-forest focus-within:ring-2 focus-within:ring-forest/20",
        className,
      )}
    >
      <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-soft" />
      <input
        data-slot="search-field"
        // `text-base` below `sm` for the same reason `fieldClass` does it: iOS
        // Safari zooms any input it renders under 16px (DESIGN.md § 6).
        className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-soft/70 sm:text-sm"
        {...props}
      />
    </label>
  );
}
