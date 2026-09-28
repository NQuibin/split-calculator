import { Coins } from "lucide-react";
import { RateInput } from "@/components/ui/RateInput";
import { CheckboxRow } from "@/components/ui/CheckboxRow";
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
          <CheckboxRow
            selected={afterTax}
            onCheckedChange={onAfterTaxChange}
            ground="plain"
            className="gap-2 text-xs text-ink-soft"
          >
            Apply tip after tax
          </CheckboxRow>
        ) : undefined
      }
    />
  );
}
