import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * The canonical field styling. `text-base` below `sm` is not a typo: iOS
 * Safari auto-zooms any input it renders under 16px, so a mobile-reachable
 * field has to be 16px and can drop to the app's 14px body size only once
 * there's a pointer (DESIGN.md § 6).
 */
export const fieldClass =
  "min-h-11 w-full min-w-0 rounded-md border border-edge bg-field px-3 py-2 text-base text-ink outline-none transition placeholder:text-ink-soft/70 focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-forest/20 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 sm:text-sm";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input data-slot="input" className={cn(fieldClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(fieldClass, "resize-y", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select data-slot="select" className={cn(fieldClass, className)} {...props} />;
}

/** A field label. Pair with the control's id, or wrap the control. */
export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn("mb-2 block text-sm font-medium text-ink", className)}
      {...props}
    />
  );
}

/**
 * A validation message. Always `role="alert"` so it's announced, and wired to
 * the control with aria-describedby by the caller.
 */
export function FieldError({ className, ...props }: ComponentProps<"p">) {
  return <p role="alert" className={cn("mt-1.5 text-xs text-margin-red-ink", className)} {...props} />;
}
