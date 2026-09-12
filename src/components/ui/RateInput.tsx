import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { DollarSign, Percent } from "lucide-react";
import type { RateSetting } from "@/lib/types";

interface RateInputProps {
  label: string;
  icon: LucideIcon;
  rate: RateSetting;
  onChange: (rate: RateSetting) => void;
  hideLabel?: boolean;
  /** Sizes the field for a currency amount rather than a short rate - see below. */
  wide?: boolean;
}

export function RateInput({ label, icon: Icon, rate, onChange, hideLabel, wide }: RateInputProps) {
  // The field holds what was typed, not a re-rendered number. `type="number"`
  // reports an in-progress value like "12." as "", which would parse to 0 and
  // wipe the field halfway through entering a decimal - so this is a text
  // input with a numeric keypad, and the text is the source of truth while
  // editing.
  const [text, setText] = useState(() => (rate.value === 0 ? "" : String(rate.value)));

  // Adopt a value that changed elsewhere - a different expense loading, or a
  // draft being seeded. Our own edits are skipped, since the text already
  // parses to the incoming value.
  const [lastValue, setLastValue] = useState(rate.value);
  if (rate.value !== lastValue) {
    setLastValue(rate.value);
    if ((Number(text) || 0) !== rate.value) setText(rate.value === 0 ? "" : String(rate.value));
  }

  function handleChange(next: string) {
    // Digits, one dot, at most two decimals. Rejecting outright rather than
    // coercing is what lets a half-typed "12." stand.
    if (next !== "" && !/^\d*\.?\d{0,2}$/.test(next)) return;
    setText(next);
    const value = Number(next) || 0;
    setLastValue(value);
    onChange({ ...rate, value });
  }

  return (
    <div className={`rate-input-row ${wide && !hideLabel ? "grid grid-cols-[5rem_minmax(0,1fr)] gap-4 sm:flex sm:items-center sm:gap-2" : "flex items-center gap-2"} ${wide ? "w-full sm:w-auto sm:flex-none" : ""}`}>
      {!hideLabel && (
        <div className={wide ? "rate-input-label flex min-w-0 items-center gap-2 sm:contents" : "contents"}>
          <Icon className="h-4 w-4 shrink-0 text-brass" strokeWidth={2.25} />
          <span className="min-w-0 font-display text-sm font-medium text-ink-soft">{label}</span>
        </div>
      )}
      <div className={`rate-input-control flex min-w-0 items-stretch rounded-md border border-edge bg-field ${wide ? "min-h-11 w-full flex-1 sm:w-auto sm:flex-none" : ""}`}>
        <input
          type="text"
          inputMode="decimal"
          value={text}
          placeholder="0"
          onChange={(e) => handleChange(e.target.value)}
          className={`font-numeric bg-transparent px-2 py-1.5 text-sm text-ink outline-none ${
            wide
              // Room for eight characters - "12345.67" - measured in `ch`,
              // which is exact here because .font-numeric is a monospace
              // face. The input's own px-2 is added on top since the box is
              // border-box.
              ? "w-full sm:w-[calc(8ch+1rem)]"
              : "w-16"
          }`}
          aria-label={`${label} value`}
        />
        <div className="flex border-l border-rule">
          <button
            type="button"
            onClick={() => onChange({ ...rate, mode: "percent" })}
            aria-pressed={rate.mode === "percent"}
            aria-label={`${label} as percent`}
            className={`inline-flex size-11 items-center justify-center transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest ${
              rate.mode === "percent" ? "bg-forest text-surface" : "text-ink-soft hover:text-forest"
            }`}
          >
            <Percent className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...rate, mode: "amount" })}
            aria-pressed={rate.mode === "amount"}
            aria-label={`${label} as dollar amount`}
            className={`inline-flex size-11 items-center justify-center rounded-r-[calc(var(--radius-md)-1px)] transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest ${
              rate.mode === "amount" ? "bg-forest text-surface" : "text-ink-soft hover:text-forest"
            }`}
          >
            <DollarSign className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
