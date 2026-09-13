import {
  cloneElement,
  useState,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import { MoreVertical } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";

/**
 * A "⋯" menu for secondary and destructive actions.
 *
 * On a phone there isn't room for every action to be its own button, and a
 * screen full of equal-weight buttons hides the one that matters. Put the
 * primary action in the header and everything rarer in here. See
 * DESIGN.md § 6.
 *
 * Actions inside are `OverflowAction`s, which are full-width rows with the
 * 44px target — not `Button`s, which would look like a button grid in a box.
 */
export function OverflowMenu({
  label = "More actions",
  children,
  className,
  align = "end",
}: {
  label?: string;
  children: ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          // The menu trigger uses a circular, faint hover/open wash while
          // preserving the full 44px touch target.
          <Button
            type="button"
            variant="menu-icon"
            size="icon-touch"
            aria-label={label}
            title={label}
            className={cn("shrink-0", className)}
          />
        }
      >
        <MoreVertical className="h-5 w-5" strokeWidth={2.25} />
      </PopoverTrigger>
      <PopoverContent align={align} className="w-56 gap-0.5 p-1.5" onClick={() => setOpen(false)}>
        {children}
      </PopoverContent>
    </Popover>
  );
}

/**
 * One row inside an OverflowMenu. Renders a `<button>` by default; pass
 * `render` with an element (a router `Link`, say) for an action that
 * navigates, so it stays a real link with a real href.
 */
export function OverflowAction({
  className,
  destructive = false,
  render,
  children,
  ...props
}: ComponentProps<"button"> & {
  destructive?: boolean;
  render?: ReactElement<{ className?: string; children?: ReactNode }>;
}) {
  const classes = cn(
    "flex min-h-11 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm transition hover:bg-wash focus-visible:bg-wash focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0",
    destructive ? "text-margin-red-ink" : "text-ink",
    className,
  );

  if (render) {
    return cloneElement(render, { className: cn(classes, render.props.className) }, children);
  }

  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  );
}
