import { Coins } from "lucide-react";
import { RateInput } from "@/components/ui/RateInput";
import { Switch } from "@/components/ui/Switch";
import type { RateSetting } from "@/lib/types";

interface TipRateInputProps {
  rate: RateSetting;
  onChange: (rate: RateSetting) => void;
  afterTax: boolean;
  onAfterTaxChange: (afterTax: boolean) => void;
  fullWidth?: boolean;
}

/**
 * The tip control, with the "after tax" order toggle under its field. The
 * toggle only shows for a percent tip - a fixed amount is the same figure
 * either way, so the choice would be meaningless.
 */
export function TipRateInput({
  rate,
  onChange,
  afterTax,
  onAfterTaxChange,
  fullWidth,
}: TipRateInputProps) {
  return (
    <RateInput
      label="Tip"
      icon={Coins}
      rate={rate}
      onChange={onChange}
      fullWidth={fullWidth}
      footer={
        rate.mode === "percent" ? (
          <div className="mt-3 flex min-h-11 items-center justify-between gap-2">
            <span className="text-sm text-ink">Apply tip after tax</span>
            <Switch
              checked={afterTax}
              onCheckedChange={onAfterTaxChange}
              aria-label="Apply tip after tax"
            />
          </div>
        ) : undefined
      }
    />
  );
}
