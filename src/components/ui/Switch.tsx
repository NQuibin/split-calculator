import { cn } from "@/lib/utils";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  disabled?: boolean;
  className?: string;
}

/** A controlled, keyboard-operable switch with a 44px touch target. */
export function Switch({ checked, onCheckedChange, className, ...props }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative h-7 w-12 rounded-full border transition-colors",
          checked ? "border-forest bg-forest" : "border-edge bg-field",
        )}
      >
        <span
          className={cn(
            "absolute inset-y-0 left-1 my-auto size-5 rounded-full shadow-sm transition-transform",
            checked ? "bg-surface" : "bg-forest",
            checked && "translate-x-5",
          )}
        />
      </span>
    </button>
  );
}
