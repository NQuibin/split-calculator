import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckboxRowProps {
  selected: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: ReactNode;
  className?: string;
  ground?: "surface" | "field" | "plain";
}

/** A 44px checkbox row with the shared right-aligned checked-circle indicator. */
export function CheckboxRow({
  selected,
  onCheckedChange,
  children,
  className,
  ground = "surface",
}: CheckboxRowProps) {
  const restingGround = {
    surface: "bg-surface",
    field: "bg-field",
    plain: "bg-transparent",
  }[ground];

  return (
    <label
      className={cn(
        "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm text-ink transition-colors hover:bg-wash active:bg-wash focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-forest",
        ground === "plain" && "border-transparent px-0",
        selected
          ? ground === "plain"
            ? "border-transparent bg-transparent"
            : "border-forest bg-field"
          : ground === "plain"
            ? "border-transparent bg-transparent"
            : `border-edge ${restingGround}`,
        className,
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className="sr-only"
      />
      {children}
      <span
        aria-hidden="true"
        className={cn(
          "ml-auto flex size-6 shrink-0 items-center justify-center rounded-full border-2",
          selected
            ? "border-forest bg-forest text-surface"
            : "border-edge bg-field text-transparent",
        )}
      >
        <Check className="size-4" strokeWidth={3} />
      </span>
    </label>
  );
}
