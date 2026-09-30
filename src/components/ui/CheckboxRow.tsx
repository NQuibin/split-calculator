import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckboxRowProps {
  selected: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: ReactNode;
  className?: string;
  ground?: "surface" | "field" | "plain";
  layout?: "row" | "compact";
}

/** A 44px checkbox control with full-row and compact layouts. */
export function CheckboxRow({
  selected,
  onCheckedChange,
  children,
  className,
  ground = "surface",
  layout = "row",
}: CheckboxRowProps) {
  const restingGround = {
    surface: "bg-surface",
    field: "bg-field",
    plain: "bg-transparent",
  }[ground];
  const indicator = (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
        layout === "row" && "ml-auto",
        selected ? "border-forest bg-forest text-surface" : "border-edge bg-field text-transparent",
      )}
    >
      <Check className="size-4" strokeWidth={3} />
    </span>
  );

  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-3 rounded-md border text-sm text-ink focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-forest",
        layout === "row"
          ? "w-full px-3 py-2 transition-colors hover:bg-wash active:bg-wash"
          : "w-fit",
        ground === "plain" && "border-transparent px-0",
        selected
          ? ground === "plain"
            ? "border-transparent bg-transparent"
            : "border-forest bg-field"
          : ground === "plain"
            ? "border-transparent bg-transparent"
            : `border-edge ${restingGround}`,
        layout === "compact" && `border-0 ${restingGround}`,
        className,
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className="sr-only"
      />
      {layout === "compact" && indicator}
      {children}
      {layout === "row" && indicator}
    </label>
  );
}
