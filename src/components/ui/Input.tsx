import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The canonical field styling. `text-base` below `sm` is not a typo: iOS
 * Safari auto-zooms any input it renders under 16px, so a mobile-reachable
 * field has to be 16px and can drop to the app's 14px body size only once
 * there's a pointer (DESIGN.md § 6).
 */
export const fieldClass =
  "min-h-11 w-full min-w-0 rounded-md border border-edge bg-field px-3 py-2 text-base text-ink outline-none transition placeholder:text-ink-soft/70 focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-forest/20 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 sm:text-sm";

interface InputProps extends ComponentProps<"input"> {
  icon?: LucideIcon;
  wrapperClassName?: string;
}

export function Input({ className, wrapperClassName, icon: Icon, ...props }: InputProps) {
  if (!Icon) return <input data-slot="input" className={cn(fieldClass, className)} {...props} />;

  return (
    <span className={cn("relative block min-w-0", wrapperClassName)}>
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
        <Icon aria-hidden="true" className="h-4 w-4 text-brass" />
      </span>
      <input data-slot="input" className={cn(fieldClass, "pl-10", className)} {...props} />
    </span>
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea data-slot="textarea" className={cn(fieldClass, "resize-y", className)} {...props} />
  );
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select data-slot="select" className={cn(fieldClass, className)} {...props} />;
}

/** A field label. Pair with the control's id, or wrap the control. */
export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: generic label primitive - htmlFor and children come from the caller, so the association is only checkable at the call site
    <label
      data-slot="label"
      className={cn("mb-2 block text-sm font-medium text-ink", className)}
      {...props}
    />
  );
}

interface FieldProps {
  label: ReactNode;
  htmlFor: string;
  children: ReactNode;
  /** Labels normally sit above controls; use `start` for concise metadata fields. */
  labelPosition?: "top" | "start";
  /** Hide the visible label only when the control has its own accessible name. */
  showLabel?: boolean;
  className?: string;
  labelClassName?: string;
}

/** Associates a label with a field and controls its responsive layout. */
export function Field({
  label,
  htmlFor,
  children,
  labelPosition = "top",
  showLabel = true,
  className,
  labelClassName,
}: FieldProps) {
  const isStart = labelPosition === "start";

  return (
    <div
      className={cn(
        "min-w-0",
        isStart && "flex flex-col gap-2 sm:flex-row sm:items-center",
        className,
      )}
    >
      {showLabel && (
        <Label htmlFor={htmlFor} className={cn(isStart && "mb-0 sm:shrink-0", labelClassName)}>
          {label}
        </Label>
      )}
      {children}
    </div>
  );
}

/**
 * A validation message. Always `role="alert"` so it's announced, and wired to
 * the control with aria-describedby by the caller.
 */
export function FieldError({ className, ...props }: ComponentProps<"p">) {
  return (
    <p role="alert" className={cn("mt-1.5 text-xs text-margin-red-ink", className)} {...props} />
  );
}
