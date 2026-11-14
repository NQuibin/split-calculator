import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { DropdownChevron } from "@/components/ui/DropdownChevron";
import { MenuOption } from "@/components/ui/MenuOption";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";

export function OptionPicker<T extends string>({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="field"
            className="min-h-11 w-full justify-between rounded-md px-3 py-2 text-base sm:text-sm"
          />
        }
      >
        <span className="min-w-0 truncate">
          {value && options.find((option) => option.value === value)?.label}
        </span>
        <DropdownChevron />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--anchor-width) max-w-(--available-width) p-2">
        <ul className="max-h-64 space-y-0.5 overflow-y-auto">
          {options.map((option) => (
            <li key={option.value}>
              <MenuOption
                selected={option.value === value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.value === "" ? <em>{option.label}</em> : option.label}
              </MenuOption>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
