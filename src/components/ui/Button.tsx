import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground",
        // A button that stands in for a form control - the popover triggers
        // behind the currency, date and tab pickers. It reads as an input, so
        // it behaves like one: the ground never fills, the border darkens to
        // --forest the way `fieldClass` does on focus. Don't use it for an
        // action; see DESIGN.md § 5.
        field:
          "border-edge bg-field font-normal text-ink hover:border-forest hover:bg-field aria-expanded:border-forest aria-expanded:bg-field",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground",
        ghost:
          "hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground",
        // Bordered like `outline`, so a destructive action can sit in a row
        // beside one without the group looking like two different controls.
        // The tint is what distinguishes it, not the absence of an edge.
        destructive:
          "border-destructive/30 bg-destructive/10 text-margin-red-ink hover:border-destructive/50 hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        // Compact destructive icon action: keep the control visually quiet and
        // signal the destructive state through the icon colour on hover.
        "destructive-icon":
          "bg-transparent text-ink-soft hover:bg-transparent hover:text-margin-red-ink focus-visible:ring-destructive/20",
        // Compact non-destructive icon action: keep the control visually quiet
        // and signal the action through the forest icon colour on hover.
        "quiet-icon": "bg-transparent text-ink-soft hover:bg-transparent hover:text-forest",
        // Overflow/menu trigger: retain the 44px touch target while its
        // hover, pressed, and open states reveal a faint circular wash.
        "menu-icon":
          "rounded-full bg-transparent text-ink-soft hover:bg-wash/70 hover:text-forest active:bg-wash/70 active:text-forest aria-expanded:bg-wash/70 aria-expanded:text-forest",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        // The sizes above are desktop-density and all fall below the 44px
        // minimum touch target (see DESIGN.md § 6). `touch` is the default for
        // any action a user taps on a phone; `hero` is the one prominent CTA
        // on a screen, and carries the display face like the page titles it
        // sits under.
        touch: "h-11 gap-2 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        hero: "h-12 gap-2 px-6 font-display text-base has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
        "icon-touch": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
