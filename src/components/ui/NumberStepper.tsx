"use client";

import { Minus, Plus } from "lucide-react";

interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export function NumberStepper({ value, onChange, min = 1, max = 30 }: NumberStepperProps) {
  return (
    <div className="inline-flex items-center gap-6">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Fewer people"
        className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border-2 border-forest text-forest transition hover:bg-forest hover:text-surface disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
      >
        <Minus className="h-5 w-5" strokeWidth={2.5} />
      </button>
      <span
        className="font-numeric w-16 text-center text-6xl font-medium tabular-nums text-ink"
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="More people"
        className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border-2 border-forest text-forest transition hover:bg-forest hover:text-surface disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
      >
        <Plus className="h-5 w-5" strokeWidth={2.5} />
      </button>
    </div>
  );
}
