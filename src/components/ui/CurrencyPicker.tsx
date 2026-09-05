"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { CURRENCIES } from "@/lib/currencies";

interface CurrencyPickerProps {
  value: string;
  onChange: (code: string) => void;
  "aria-label"?: string;
}

// Strips diacritics so "colon" matches "Colón" and "cordoba" matches "Córdoba".
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function CurrencyPicker({ value, onChange, ...props }: CurrencyPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return CURRENCIES;
    return CURRENCIES.filter((c) => normalize(c.code).includes(q) || normalize(c.name).includes(q));
  }, [query]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            aria-label={props["aria-label"]}
            className="h-auto cursor-pointer gap-1.5 rounded-md border-rule bg-surface px-2 py-1.5 font-normal text-ink hover:border-forest hover:bg-surface aria-expanded:border-forest aria-expanded:bg-surface"
          />
        }
      >
        <span className="font-numeric">{value}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 rounded-lg border-rule bg-surface p-2">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search currency…"
          aria-label="Search currency"
          className="mb-2 w-full rounded-md border border-rule bg-paper px-2.5 py-1.5 text-sm text-ink outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-margin-red/40"
        />
        <ul className="max-h-56 space-y-0.5 overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="px-2 py-1.5 text-sm text-ink-soft">No matches.</li>
          ) : (
            filtered.map((c) => (
              <li key={c.code}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(c.code);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm text-ink transition hover:bg-paper"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="font-numeric font-semibold">{c.code}</span>
                    <span className="truncate text-ink-soft">{c.name}</span>
                  </span>
                  {c.code === value && <Check className="h-3.5 w-3.5 shrink-0 text-forest" strokeWidth={2.5} />}
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
