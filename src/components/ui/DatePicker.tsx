import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Calendar } from "@/components/ui/Calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { parseISODate, toISODate } from "@/lib/format";

interface DatePickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  "aria-label"?: string;
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
            className="h-auto min-h-11 min-w-11 gap-1.5 rounded-md px-2 py-1.5"
          />
        }
      >
        <span className="font-numeric">{value || "Pick a date"}</span>
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
