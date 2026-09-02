import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      // `bg-muted` resolves to the same color as the page background
      // (--muted is aliased to --paper, see globals.css), which makes a
      // default skeleton invisible anywhere outside a `bg-surface` card.
      // `bg-rule` - the app's border/divider tone - stays visible on both.
      className={cn("animate-pulse rounded-md bg-rule/60", className)}
      {...props}
    />
  )
}

export { Skeleton }
