import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { MenuOption } from "@/components/ui/MenuOption";
import { SearchField } from "@/components/ui/SearchField";
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
            variant="field"
            aria-label={props["aria-label"]}
            className="h-auto min-h-11 min-w-11 gap-1.5 rounded-md px-2 py-1.5"
          />
        }
      >
        <span className="font-numeric">{value}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 rounded-lg p-2">
        <SearchField
          // Focus management for a popover the user just opened, not focus
          // stolen on load - the filter box is the only reason to open it.
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search currency…"
          aria-label="Search currency"
          className="mb-2"
        />
        <ul className="max-h-56 space-y-0.5 overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="px-2 py-1.5 text-sm text-ink-soft">No matches.</li>
          ) : (
            filtered.map((c) => (
              <li key={c.code}>
                <MenuOption
                  selected={c.code === value}
                  onClick={() => {
                    onChange(c.code);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="font-numeric font-semibold">{c.code}</span>
                    <span className="truncate text-ink-soft">{c.name}</span>
                  </span>
                </MenuOption>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
