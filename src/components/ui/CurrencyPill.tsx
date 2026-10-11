export function CurrencyPill({ code }: { code: string }) {
  return (
    <span className="inline-flex rounded-full border border-rule bg-chip-neutral px-3 py-1 font-numeric text-xs font-semibold text-ink">
      {code}
    </span>
  );
}
