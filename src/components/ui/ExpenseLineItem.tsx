import { MemberAvatar } from "@/components/MemberAvatar";
import { Button } from "@/components/ui/Button";
import { Asterisk, Pencil, Trash2 } from "lucide-react";
import { discountAmount } from "@/lib/calculations";
import { currency } from "@/lib/format";
import type { Person, ExpenseItem, RateSetting } from "@/lib/types";

function formatRate(label: string, rate: RateSetting, code: string): string {
  return rate.mode === "percent" ? `${label} ${rate.value}%` : `${label} ${currency(rate.value, code)}`;
}

interface ExpenseLineItemProps {
  item: ExpenseItem;
  index: number;
  people: Person[];
  currency: string;
  isEditing: boolean;
  hasOverrides: boolean;
  onEdit: () => void;
  onRemove: () => void;
}

export function ExpenseLineItem({
  item,
  index,
  people,
  currency: currencyCode,
  isEditing,
  hasOverrides,
  onEdit,
  onRemove,
}: ExpenseLineItemProps) {
  function personName(id: string): string {
    return people.find((p) => p.id === id)?.name ?? "?";
  }

  const rateLabels = [item.tax.value > 0 ? formatRate("Tax", item.tax, currencyCode) : null, item.tip.value > 0 ? formatRate("Tip", item.tip, currencyCode) : null].filter(
    (s): s is string => s !== null,
  );

  return (
    <li
        className={`rounded-lg border bg-surface text-sm transition-colors hover:bg-wash ${isEditing ? "border-forest" : "border-rule"}`}
      >
        <div className="flex flex-wrap items-center gap-1 px-4 py-2 sm:gap-2">
        <button type="button" onClick={onEdit} aria-haspopup="dialog" className="min-h-11 min-w-24 flex-1 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
          <p className="break-words text-ink">
            <span className="font-numeric text-ink-soft">{index + 1}.</span> {item.name}
            {hasOverrides && (
              <span className="ml-0.5 text-brass" title="Overrides global discount, tax and tip">
                <Asterisk aria-hidden="true" className="inline h-3 w-3 align-super" />
                <span className="sr-only">Overrides global discount, tax and tip</span>
              </span>
            )}
          </p>
          <span className="mt-2 flex flex-wrap gap-y-2 pl-1" aria-label={`Split with ${item.splitWith.map(personName).join(", ") || "no one"}`}>
            {item.splitWith.map(id => <MemberAvatar key={id} id={id} name={personName(id)} size="sm" className="-ml-1 ring-2 ring-surface" />)}
          </span>
          {rateLabels.length > 0 && <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-soft">
            {rateLabels.map(label => <span key={label}>{label}</span>)}
          </span>}
        </button>

        <div className="ml-auto flex flex-wrap items-center gap-0">
          <span className="font-numeric flex flex-wrap items-baseline justify-end gap-x-2 text-ink">
            {item.discount.value > 0 && <>
              <span className="sr-only">Original price </span>
              <s className="text-xs text-ink-soft">{currency(item.cost, currencyCode)}</s>
            </>}
            <span>
              <span className="sr-only">{item.discount.value > 0 ? "Discounted price before tax and tip " : "Price before tax and tip "}</span>
              {currency(Math.max(0, item.cost - discountAmount(item)), currencyCode)}
            </span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-touch"
            onClick={onEdit}
            aria-label={`Edit ${item.name}`}
            aria-haspopup="dialog"
            className="text-ink-soft hover:text-forest"
          >
            <Pencil className="h-4 w-4" strokeWidth={2.25} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-touch"
            onClick={onRemove}
            aria-label={`Remove ${item.name}`}
            className="text-ink-soft hover:text-margin-red-ink"
          >
            <Trash2 className="h-4 w-4" strokeWidth={2.25} />
          </Button>
        </div>
        </div>
    </li>
  );
}
