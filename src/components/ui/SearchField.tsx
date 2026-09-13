import { useId, type ComponentProps } from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input, Label } from "@/components/ui/Input";

/**
 * A search control with a persistent label and a decorative magnifier.
 * Compact search regions may hide the visible label while retaining the
 * required accessible name.
 */
interface SearchFieldProps extends ComponentProps<"input"> {
  "aria-label": string;
  /** Layout only — width, flex behaviour, outer margin. Not field styling. */
  className?: string;
  /** Use in an already-labelled compact region; the accessible name remains required. */
  showLabel?: boolean;
}

export function SearchField({ className, showLabel = true, ...props }: SearchFieldProps) {
  const label = props["aria-label"];
  const generatedId = useId();
  const inputId = props.id ?? generatedId;
  return (
    <div className={cn("min-w-0", className)}>
      {showLabel && <Label htmlFor={inputId}>{label}</Label>}
      <Input {...props} id={inputId} icon={Search} data-slot="search-field" />
    </div>
  );
}
