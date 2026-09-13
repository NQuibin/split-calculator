import { Coins } from "lucide-react";
import { RateInput } from "@/components/ui/RateInput";
import type { RateSetting } from "@/lib/types";

interface TipRateInputProps {
  rate: RateSetting;
  onChange: (rate: RateSetting) => void;
  afterTax: boolean;
  onAfterTaxChange: (afterTax: boolean) => void;
}

/**
 * The tip control, with the "after tax" order toggle under its field. The
 * toggle only shows for a percent tip - a fixed amount is the same figure
 * either way, so the choice would be meaningless.
 */
export function TipRateInput({ rate, onChange, afterTax, onAfterTaxChange }: TipRateInputProps) {
  return (
    <RateInput
      label="Tip"
      icon={Coins}
      rate={rate}
      onChange={onChange}
      footer={
        rate.mode === "percent" ? (
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs text-ink-soft">
            <input
              type="checkbox"
              checked={afterTax}
              onChange={(event) => onAfterTaxChange(event.target.checked)}
              className="h-5 w-5 shrink-0 accent-forest"
            />
            Apply tip after tax
          </label>
        ) : undefined
      }
    />
  );
}
