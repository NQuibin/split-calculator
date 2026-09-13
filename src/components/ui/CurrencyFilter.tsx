import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MenuOption } from "@/components/ui/MenuOption";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";

export function CurrencyFilter({
  value,
  onChange,
  codes,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  codes: string[];
  label: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="field"
            aria-label={label}
            className="group min-h-11 shrink-0 gap-3 rounded-lg px-3 text-xs"
          />
        }
      >
        {value === "all" ? "All currencies" : value}
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-ink-soft chevron-flip" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 rounded-lg p-2">
        <ul className="max-h-56 space-y-0.5 overflow-y-auto">
          {["all", ...codes].map((code) => (
            <li key={code}>
              <MenuOption
                selected={value === code}
                onClick={() => {
                  onChange(code);
                  setOpen(false);
                }}
              >
                {code === "all" ? "All currencies" : code}
              </MenuOption>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
