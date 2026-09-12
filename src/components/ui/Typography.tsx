import type { ComponentProps, ElementType } from "react";

import { cn } from "@/lib/utils";

/**
 * The app's heading scale, as components rather than remembered class strings.
 * See DESIGN.md § 2 — these are the only heading sizes.
 *
 * The rule that keeps the two small sizes apart: a *heading* labels a block of
 * content and is semibold; a *field label* names one control and is medium
 * (that's `Label` in ui/Input.tsx, and it renders a real `<label>`).
 */

/** The one `<h1>` on a page. */
export function PageTitle({ className, ...props }: ComponentProps<"h1">) {
  return (
    <h1
      className={cn(
        "font-display text-3xl font-semibold tracking-tight text-ink break-words",
        className
      )}
      {...props}
    />
  );
}

/** The supporting line under a PageTitle. */
export function PageDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("mt-2 text-sm text-ink-soft", className)} {...props} />;
}

/**
 * A card, panel, dialog or list-row heading. Defaults to `<h2>`; pass `as` to
 * keep the document outline correct when it sits deeper.
 */
export function SectionTitle({
  className,
  as: As = "h2",
  ...props
}: ComponentProps<"h2"> & { as?: ElementType }) {
  return (
    <As
      className={cn("font-display text-lg font-semibold text-ink break-words", className)}
      {...props}
    />
  );
}

/**
 * The smallest heading — names a group inside a panel ("Note", "Receipt",
 * "Split with"). Defaults to `<h3>`.
 */
export function GroupTitle({
  className,
  as: As = "h3",
  ...props
}: ComponentProps<"h3"> & { as?: ElementType }) {
  return <As className={cn("text-sm font-semibold text-ink", className)} {...props} />;
}
