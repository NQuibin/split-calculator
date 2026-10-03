import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("block motion-safe:animate-pulse bg-chip-neutral", className)}
    />
  );
}
