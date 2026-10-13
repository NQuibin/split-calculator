import { cn } from "@/lib/utils";

export function CurrencyPill({ code, className }: { code: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full bg-currency-chip px-3 py-1 font-numeric text-sm font-semibold text-currency-chip-ink",
        className,
      )}
    >
      {code}
    </span>
  );
}
