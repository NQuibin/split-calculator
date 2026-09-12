import type { ComponentProps } from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

interface MenuOptionProps extends ComponentProps<"button"> {
  /** Marks the row as the current choice and renders the trailing check. */
  selected?: boolean;
  /**
   * An action row ("New tab") rather than a choice: no check, no pressed
   * state, since it doesn't represent a value the popover can be set to.
   */
  action?: boolean;
}

/**
 * A selectable row inside a Popover list — the currency pickers, the tab
 * picker. These are tap targets on mobile, so they carry the 44px minimum
 * from DESIGN.md § 6 rather than the denser desktop padding they grew up with.
 */
export function MenuOption({ className, children, selected, action, ...props }: MenuOptionProps) {
  return (
    <button
      type="button"
      aria-pressed={action ? undefined : selected}
      className={cn(
        "flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm text-ink transition hover:bg-wash focus-visible:bg-wash focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest",
        className
      )}
      {...props}
    >
      {children}
      {!action && selected ? (
        <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-forest" strokeWidth={2.5} />
      ) : null}
    </button>
  );
}
