"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Calendar } from "@/components/ui/Calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { parseISODate, toISODate } from "@/lib/format";

interface DatePickerProps {
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
            variant="outline"
            aria-label={props["aria-label"]}
            className="h-auto cursor-pointer gap-1.5 rounded-md border-rule bg-surface px-2 py-1.5 font-normal text-ink hover:border-forest hover:bg-surface aria-expanded:border-forest aria-expanded:bg-surface"
          />
        }
      >
        <span className="font-numeric">{value || "Pick a date"}</span>
      </PopoverTrigger>
      <PopoverContent className="w-auto rounded-lg border-rule bg-surface p-0">
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
