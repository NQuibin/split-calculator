"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";

export function CurrencyFilter({ value, onChange, codes, label }: {
  value: string;
  onChange: (value: string) => void;
  codes: string[];
  label: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" aria-label={label} className="h-9 shrink-0 gap-3 rounded-lg border-rule bg-paper px-3 text-xs font-normal text-ink hover:border-forest hover:bg-paper aria-expanded:border-forest aria-expanded:bg-paper" />}>
        {value === "all" ? "All currencies" : value}
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-ink-soft" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 rounded-lg border-rule bg-surface p-2">
        <ul className="max-h-56 space-y-0.5 overflow-y-auto">
          {["all", ...codes].map(code => (
            <li key={code}>
              <button type="button" aria-pressed={value === code} onClick={() => { onChange(code); setOpen(false); }} className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm font-normal text-ink transition hover:bg-paper focus-visible:bg-paper focus-visible:outline-2 focus-visible:outline-forest">
                {code === "all" ? "All currencies" : code}
                {value === code && <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-forest" strokeWidth={2.5} />}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
