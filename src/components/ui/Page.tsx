import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The page shell. Every route renders exactly one of these, so horizontal
 * padding, max width and vertical rhythm can't drift between pages — they used
 * to live in three copied `pageClass` constants plus eight inline strings.
 *
 * `pb-[env(safe-area-inset-bottom)]` keeps the last control clear of the home
 * indicator on a notched phone (DESIGN.md § 6).
 */
const widths = {
  /** The default. Directories, settings, an expense. */
  default: "max-w-5xl",
  /** The tab's expense grid, which needs the extra columns. */
  wide: "max-w-7xl",
  /** A single-purpose centred state: access errors, invites, empty shells. */
  narrow: "max-w-lg",
} as const;

export function Page({
  className,
  width = "default",
  center = false,
  ...props
}: ComponentProps<"main"> & { width?: keyof typeof widths; center?: boolean }) {
  return (
    <main
      id="main"
      tabIndex={-1}
      className={cn(
        "mx-auto flex w-full flex-1 flex-col px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-8 md:px-10 md:pb-12 md:pt-12",
        widths[width],
        center && "justify-center py-16 md:py-24",
        className,
      )}
      {...props}
    />
  );
}

/** A raised surface: a card, a list container, a settings group. */
export function Panel({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("overflow-hidden rounded-xl border border-rule/70 bg-surface/80", className)}
      {...props}
    />
  );
}

/**
 * The dashed placeholder shown where content would be: loading, signed out, or
 * genuinely empty. `status` makes it a live region so a screen reader hears the
 * list resolve — use it for loading and for "nothing here yet", not for errors
 * (those are `role="alert"`).
 */
export function EmptyState({
  className,
  status = true,
  children,
  ...props
}: ComponentProps<"p"> & { status?: boolean; children: ReactNode }) {
  return (
    <p
      role={status ? "status" : undefined}
      className={cn(
        "rounded-xl border border-dashed border-rule bg-surface/60 px-6 py-10 text-center text-sm text-ink-soft",
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
}
