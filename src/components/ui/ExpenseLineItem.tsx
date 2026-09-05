"use client";

import { motion, Reorder, useDragControls } from "motion/react";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { discountAmount } from "@/lib/calculations";
import { currency } from "@/lib/format";
import type { Person, ExpenseItem, RateSetting } from "@/lib/types";

function formatRate(label: string, rate: RateSetting, code: string): string | null {
  if (rate.value <= 0) return null;
  return rate.mode === "percent" ? `${label} ${rate.value}%` : `${label} ${currency(rate.value, code)}`;
}

interface ExpenseLineItemProps {
  item: ExpenseItem;
  index: number;
  people: Person[];
  currency: string;
  isEditing: boolean;
  isNew: boolean;
  onEdit: () => void;
  onRemove: () => void;
}

export function ExpenseLineItem({
  item,
  index,
  people,
  currency: currencyCode,
  isEditing,
  isNew,
  onEdit,
  onRemove,
}: ExpenseLineItemProps) {
  const controls = useDragControls();

  function personName(id: string): string {
    return people.find((p) => p.id === id)?.name ?? "?";
  }

  const rateLabels = [formatRate("tax", item.tax, currencyCode), formatRate("tip", item.tip, currencyCode)].filter(
    (s): s is string => s !== null,
  );

  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      as="li"
      whileDrag={{ scale: 1.02, boxShadow: "0 6px 16px rgba(30, 42, 34, 0.18)" }}
    >
      <motion.div
        initial={isNew ? { opacity: 0, y: -8 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className={`flex items-start gap-2 rounded-md bg-surface text-sm ${isEditing ? "ring-2 ring-brass" : ""}`}
      >
        <button
          type="button"
          onPointerDown={(e) => controls.start(e)}
          aria-label={`Reorder ${item.name}`}
          className="mt-0.5 shrink-0 cursor-grab touch-none text-ink-soft/50 transition hover:text-ink-soft active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" strokeWidth={2} />
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-ink">
            <span className="font-numeric text-ink-soft">{index + 1}.</span> {item.name}
          </p>
          <p className="truncate text-xs text-ink-soft">
            {rateLabels.length > 0 && `${rateLabels.join(" · ")} · `}
            {item.splitWith.length === people.length
              ? "everyone"
              : item.splitWith.map(personName).join(", ")}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className="font-numeric text-ink">
            {item.discount.value > 0 ? (
              <>
                <span className="text-ink-soft line-through">{currency(item.cost, currencyCode)}</span>{" "}
                {currency(Math.max(0, item.cost - discountAmount(item)), currencyCode)}
              </>
            ) : (
              currency(item.cost, currencyCode)
            )}
          </span>
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${item.name}`}
            className="cursor-pointer text-ink-soft transition hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
          >
            <Pencil className="h-4 w-4" strokeWidth={2.25} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${item.name}`}
            className="cursor-pointer text-ink-soft transition hover:text-margin-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
          >
            <Trash2 className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>
      </motion.div>
    </Reorder.Item>
  );
}
