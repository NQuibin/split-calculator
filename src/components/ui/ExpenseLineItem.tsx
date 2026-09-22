import { MemberAvatar } from "@/components/MemberAvatar";
import { Button } from "@/components/ui/Button";
import { Asterisk, Pencil, Trash2 } from "lucide-react";
import { discountAmount } from "@/lib/calculations";
import { useLocaleFormatters } from "@/lib/localeFormatters";
import type { Person, ExpenseItem, RateSetting } from "@/lib/types";

function formatRate(
  label: string,
  rate: RateSetting,
  code: string,
  currency: (amount: number, currency?: string) => string,
): string {
  return rate.mode === "percent"
    ? `${label} ${rate.value}%`
    : `${label} ${currency(rate.value, code)}`;
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
  const { currency } = useLocaleFormatters();
  function personName(id: string): string {
    return people.find((p) => p.id === id)?.name ?? "?";
  }

  const rateLabels = [
    item.tax.value > 0 ? formatRate("Tax", item.tax, currencyCode, currency) : null,
    item.tip.value > 0 ? formatRate("Tip", item.tip, currencyCode, currency) : null,
  ].filter((s): s is string => s !== null);

  return (
    <li
      className={`relative grid grid-cols-[minmax(0,1fr)_auto] items-center bleed-px text-sm transition-colors hover:bg-wash ${isEditing ? "bg-wash" : "bg-field"}`}
    >
      <div className="min-w-0">
        <button
          type="button"
          onClick={onEdit}
          aria-haspopup="dialog"
          className="relative flex min-h-11 min-w-0 w-full flex-col justify-center py-2 text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-forest"
        >
          <p className="break-words text-ink">
            <span className="font-numeric text-ink-soft">{index + 1}.</span> {item.name}
            {hasOverrides && (
              <span className="ml-0.5 text-brass" title="Overrides global discount, tax and tip">
                <Asterisk aria-hidden="true" className="inline h-3 w-3 align-super" />
                <span className="sr-only">Overrides global discount, tax and tip</span>
              </span>
            )}
          </p>
          {/* This sits inside the button, so the split reads as part of the
              button's name. The avatars are hidden rather than labelled, or
              each one's own name would be announced again after this. */}
          <span className="sr-only">
            Split with {item.splitWith.map(personName).join(", ") || "no one"}
          </span>
          <span aria-hidden="true" className="mt-2 flex flex-wrap gap-y-2 pl-1">
            {item.splitWith.map((id) => (
              <MemberAvatar
                key={id}
                id={id}
                name={personName(id)}
                size="sm"
                className="-ml-1 ring-2 ring-field"
              />
            ))}
          </span>
          {rateLabels.length > 0 && (
            <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-soft">
              {rateLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </span>
          )}
        </button>
      </div>

      <div className="relative z-10 flex items-center gap-0">
        <span className="font-numeric flex flex-wrap items-baseline justify-end gap-x-2 text-ink">
          {item.discount.value > 0 && (
            <>
              <span className="sr-only">Original price </span>
              <s className="text-xs text-ink-soft">{currency(item.cost, currencyCode)}</s>
            </>
          )}
          <span>
            <span className="sr-only">
              {item.discount.value > 0
                ? "Discounted price before tax and tip "
                : "Price before tax and tip "}
            </span>
            {currency(Math.max(0, item.cost - discountAmount(item)), currencyCode)}
          </span>
        </span>
        <Button
          type="button"
          variant="quiet-icon"
          size="icon"
          className="ml-2"
          onClick={onEdit}
          aria-label={`Edit ${item.name}`}
          aria-haspopup="dialog"
        >
          <Pencil className="h-4 w-4" strokeWidth={2.25} />
        </Button>
        <Button
          type="button"
          variant="destructive-icon"
          size="icon"
          onClick={onRemove}
          aria-label={`Remove ${item.name}`}
        >
          <Trash2 className="h-4 w-4" strokeWidth={2.25} />
        </Button>
      </div>
    </li>
  );
}
