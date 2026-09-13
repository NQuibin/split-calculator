import type { ComponentProps } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/** A dropdown indicator that rotates while its parent trigger is expanded. */
export function DropdownChevron({ className, ...props }: ComponentProps<typeof ChevronDown>) {
  return (
    <ChevronDown
      aria-hidden="true"
      className={cn("h-4 w-4 shrink-0 text-ink-soft chevron-flip", className)}
      {...props}
    />
  );
}
