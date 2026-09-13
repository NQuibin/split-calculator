import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Calendar } from "@/components/ui/Calendar";
import { DropdownChevron } from "@/components/ui/DropdownChevron";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { parseISODate, toISODate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CalendarDays } from "lucide-react";

interface DatePickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  "aria-label"?: string;
  className?: string;
}

export function DatePicker({ value, onChange, ...props }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseISODate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
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
          <CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0 text-brass" />
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
          defaultMonth={selected}
          onSelect={(date) => {
            if (!date) return;
            onChange(toISODate(date));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
