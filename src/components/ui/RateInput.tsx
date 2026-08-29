"use client";

import type { LucideIcon } from "lucide-react";
import { DollarSign, Percent } from "lucide-react";
import type { RateSetting } from "@/lib/types";

interface RateInputProps {
  label: string;
  icon: LucideIcon;
  rate: RateSetting;
  onChange: (rate: RateSetting) => void;
}

export function RateInput({ label, icon: Icon, rate, onChange }: RateInputProps) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-brass" strokeWidth={2.25} />
      <span className="font-display text-sm font-medium text-ink-soft">{label}</span>
      <div className="flex items-center rounded-md border border-rule bg-surface">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step={rate.mode === "percent" ? 0.1 : 0.01}
          value={rate.value === 0 ? "" : rate.value}
          placeholder="0"
          onChange={(e) => onChange({ ...rate, value: Number(e.target.value) || 0 })}
          className="font-numeric w-16 bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
          aria-label={`${label} value`}
        />
        <div className="flex border-l border-rule">
          <button
            type="button"
            onClick={() => onChange({ ...rate, mode: "percent" })}
            aria-pressed={rate.mode === "percent"}
            aria-label={`${label} as percent`}
            className={`px-2 py-1.5 transition ${
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
            className={`px-2 py-1.5 transition ${
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
