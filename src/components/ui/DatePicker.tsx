import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Calendar } from "@/components/ui/Calendar";
import { DropdownChevron } from "@/components/ui/DropdownChevron";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { parseISODate, toISODate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  "aria-label"?: string;
  className?: string;
  min?: string;
  max?: string;
  allowClear?: boolean;
}

export function DatePicker({ value, onChange, ...props }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseISODate(value);
  const min = parseISODate(props.min ?? "");
  const max = parseISODate(props.max ?? "");
  const disabled = [...(min ? [{ before: min }] : []), ...(max ? [{ after: max }] : [])];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="field"
            aria-label={props["aria-label"]}
            id={props.id}
            className={cn(
              "h-auto min-h-11 min-w-11 max-w-full gap-2 rounded-md px-3 py-1.5",
              props.className,
            )}
          />
        }
      >
        <span className="flex w-full min-w-0 items-center gap-2 text-base sm:text-sm">
          <span className="min-w-0 flex-1 truncate text-left font-numeric">
            {value || "Pick a date"}
          </span>
          <DropdownChevron />
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-auto rounded-lg p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? min}
          disabled={disabled}
          onSelect={(date) => {
            if (!date) return;
            onChange(toISODate(date));
            setOpen(false);
          }}
        />
        {props.allowClear && value && (
          <div className="border-t border-rule px-3 pb-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="touch"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear date
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
