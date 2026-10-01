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
  discountRate: RateSetting;
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
  discountRate,
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
      className={`relative grid grid-cols-[minmax(0,1fr)_auto] items-center bleed-px text-sm transition-colors hover:bg-wash active:bg-wash md:grid-cols-[minmax(0,1fr)_13rem] ${isEditing ? "bg-wash" : "bg-field"}`}
    >
      <div className="min-w-0">
        <button
          type="button"
          onClick={onEdit}
          aria-haspopup="dialog"
          className="relative grid min-h-11 min-w-0 w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-1 py-2 text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-forest md:grid-cols-[auto_minmax(0,1fr)_8rem] md:gap-x-2"
        >
          <span className="font-numeric text-ink-soft">{index + 1}.</span>
          <p className="min-w-0 break-words text-ink">
            {item.name}
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
          <span
            aria-hidden="true"
            className="col-span-2 row-start-2 mt-2 flex flex-wrap gap-y-2 pl-1 md:col-span-1 md:col-start-3 md:row-start-1 md:mt-0 md:self-center"
          >
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
            <span className="col-start-2 row-start-3 mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-soft md:row-start-2">
              {rateLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </span>
          )}
        </button>
      </div>

      <div className="relative z-10 flex items-center justify-end gap-0">
        <span className="font-numeric flex flex-col items-end text-ink">
          {item.discount.value > 0 && (
            <span className="text-xs text-ink-soft">
              <span className="sr-only">Subtotal </span>
              {currency(item.cost, currencyCode)} (
              {discountRate.mode === "percent"
                ? `-%${discountRate.value}`
                : `-${currency(discountAmount(item), currencyCode)}`}
              )
            </span>
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
