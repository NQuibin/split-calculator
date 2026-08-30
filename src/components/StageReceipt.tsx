"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, Reorder } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Coins,
  Pencil,
  Percent,
  Plus,
  Receipt,
  TicketPercent,
} from "lucide-react";
import { PersonChip } from "@/components/ui/PersonChip";
import { RateInput } from "@/components/ui/RateInput";
import { ReceiptLineItem } from "@/components/ui/ReceiptLineItem";
import { computeSplit } from "@/lib/calculations";
import { currency } from "@/lib/format";
import type { Person, RateSetting, ReceiptItem } from "@/lib/types";

interface StageReceiptProps {
  people: Person[];
  items: ReceiptItem[];
  tax: RateSetting;
  tip: RateSetting;
  onSetTax: (rate: RateSetting) => void;
  onSetTip: (rate: RateSetting) => void;
  onAddItem: (item: ReceiptItem) => void;
  onUpdateItem: (item: ReceiptItem) => void;
  onRemoveItem: (id: string) => void;
  onReorderItems: (items: ReceiptItem[]) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function StageReceipt({
  people,
  items,
  tax,
  tip,
  onSetTax,
  onSetTip,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onReorderItems,
  onBack,
  onContinue,
}: StageReceiptProps) {
  const allIds = useMemo(() => people.map((p) => p.id), [people]);

  // Items already present when this page mounts shouldn't play the
  // "just added" entrance animation - only ones added afterward should.
  const [initialItemIds] = useState(() => new Set(items.map((item) => item.id)));

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [discount, setDiscount] = useState<RateSetting>({ mode: "amount", value: 0 });
  const [taxed, setTaxed] = useState(true);
  const [tipped, setTipped] = useState(true);
  const [splitWith, setSplitWith] = useState<string[]>(allIds);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => computeSplit(people, items, tax, tip), [people, items, tax, tip]);

  const taxIsActive = tax.value > 0;
  const tipIsActive = tip.value > 0;
  const effectiveTaxed = taxed && taxIsActive;
  const effectiveTipped = tipped && tipIsActive;

  function togglePerson(id: string) {
    setSplitWith((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setCost("");
    setDiscount({ mode: "amount", value: 0 });
    setTaxed(true);
    setTipped(true);
    setSplitWith(allIds);
    setError(null);
  }

  function startEdit(item: ReceiptItem) {
    setEditingId(item.id);
    setName(item.name);
    setCost(String(item.cost));
    setDiscount(item.discount);
    setTaxed(item.taxed);
    setTipped(item.tipped);
    setSplitWith(item.splitWith);
    setError(null);
  }

  function handleRemove(id: string) {
    if (id === editingId) resetForm();
    onRemoveItem(id);
  }

  function handleSubmit() {
    const parsedCost = Number(cost);
    if (!name.trim()) {
      setError("Give the item a name.");
      return;
    }
    if (!parsedCost || parsedCost <= 0) {
      setError("Enter a cost greater than $0.");
      return;
    }
    if (discount.value < 0) {
      setError("Discount can't be negative.");
      return;
    }
    if (splitWith.length === 0) {
      setError("Pick who's sharing this item.");
      return;
    }
    const item: ReceiptItem = {
      id: editingId ?? crypto.randomUUID(),
      name: name.trim(),
      cost: parsedCost,
      discount,
      taxed: effectiveTaxed,
      tipped: effectiveTipped,
      splitWith,
    };
    if (editingId) {
      onUpdateItem(item);
    } else {
      onAddItem(item);
    }
    resetForm();
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-ink-soft transition hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
          {people.length} people
        </button>
        <div className="flex items-center gap-2 text-brass">
          <Receipt className="h-5 w-5" strokeWidth={2.25} />
          <span className="font-display text-sm font-semibold tracking-wide uppercase">
            The receipt
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-rule bg-surface p-5">
        <div className="mb-4 flex flex-wrap gap-4 border-b border-rule pb-4">
          <RateInput label="Tax" icon={Percent} rate={tax} onChange={onSetTax} />
          <RateInput label="Tip" icon={Coins} rate={tip} onChange={onSetTip} />
        </div>

        <motion.div
          layout
          transition={{ layout: { duration: 0.25, ease: "easeInOut" } }}
          className={`space-y-3 transition-shadow duration-200 ${
            editingId ? "-m-3 rounded-md p-3 ring-2 ring-brass" : ""
          }`}
        >
          <AnimatePresence initial={false}>
            {editingId && (
              <motion.div
                key="editing-banner"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-1.5 rounded-md bg-brass/15 px-3 py-2 text-sm font-medium text-ink">
                  <Pencil className="h-3.5 w-3.5 text-brass" strokeWidth={2.5} />
                  Editing line item
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Item, e.g. Nachos"
              className="flex-1 rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-margin-red/40"
            />
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="0.00"
              aria-label="Item cost"
              className="font-numeric w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-margin-red/40 sm:w-28"
            />
          </div>

          <div>
            <p className="mb-1 flex items-center gap-1 text-xs font-medium tracking-wide text-ink-soft uppercase">
              <TicketPercent className="h-3.5 w-3.5" strokeWidth={2.25} />
              Discount, before tax &amp; tip
            </p>
            <RateInput label="Discount" icon={TicketPercent} rate={discount} onChange={setDiscount} hideLabel />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label
              className={`flex items-center gap-1.5 text-sm ${
                taxIsActive ? "text-ink-soft" : "text-ink-soft/50"
              }`}
              title={taxIsActive ? undefined : "Set a tax rate above to enable"}
            >
              <input
                type="checkbox"
                checked={effectiveTaxed}
                disabled={!taxIsActive}
                onChange={(e) => setTaxed(e.target.checked)}
                className="h-4 w-4 accent-forest disabled:cursor-not-allowed"
              />
              Taxed
            </label>
            <label
              className={`flex items-center gap-1.5 text-sm ${
                tipIsActive ? "text-ink-soft" : "text-ink-soft/50"
              }`}
              title={tipIsActive ? undefined : "Set a tip rate above to enable"}
            >
              <input
                type="checkbox"
                checked={effectiveTipped}
                disabled={!tipIsActive}
                onChange={(e) => setTipped(e.target.checked)}
                className="h-4 w-4 accent-forest disabled:cursor-not-allowed"
              />
              Tipped
            </label>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium tracking-wide text-ink-soft uppercase">
              Split with
            </p>
            <div className="flex flex-wrap gap-2">
              {people.map((p) => (
                <PersonChip
                  key={p.id}
                  name={p.name}
                  selected={splitWith.includes(p.id)}
                  onToggle={() => togglePerson(p.id)}
                />
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-margin-red">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-surface transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red ${
                editingId ? "bg-brass hover:bg-brass/80" : "bg-forest hover:bg-ink"
              }`}
            >
              {editingId ? (
                <>
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                  Save changes
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                  Add to receipt
                </>
              )}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="cursor-pointer text-sm font-medium text-ink-soft transition hover:text-margin-red"
              >
                Cancel
              </button>
            )}
          </div>
        </motion.div>

        {items.length > 0 && (
          <Reorder.Group
            as="ul"
            axis="y"
            layout
            transition={{ layout: { duration: 0.25, ease: "easeInOut" } }}
            values={items}
            onReorder={onReorderItems}
            className="perforated-top mt-5 space-y-2 pt-4"
          >
            {items.map((item, i) => (
              <ReceiptLineItem
                key={item.id}
                item={item}
                index={i}
                people={people}
                isEditing={item.id === editingId}
                isNew={!initialItemIds.has(item.id)}
                onEdit={() => startEdit(item)}
                onRemove={() => handleRemove(item.id)}
              />
            ))}
          </Reorder.Group>
        )}

        <motion.div
          layout
          transition={{ layout: { duration: 0.25, ease: "easeInOut" } }}
          className="perforated-top mt-4 space-y-1 pt-4 text-sm"
        >
          <div className="flex justify-between text-ink-soft">
            <span>Subtotal</span>
            <span className="font-numeric">{currency(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-ink-soft">
            <span>Tax</span>
            <span className="font-numeric">{currency(totals.taxTotal)}</span>
          </div>
          <div className="flex justify-between text-ink-soft">
            <span>Tip</span>
            <span className="font-numeric">{currency(totals.tipTotal)}</span>
          </div>
          <div className="flex justify-between pt-1 font-display text-base font-semibold text-ink">
            <span>Total</span>
            <span className="font-numeric">{currency(totals.grandTotal)}</span>
          </div>
        </motion.div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onContinue}
          disabled={items.length === 0}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-margin-red px-6 py-3 font-display font-semibold text-surface transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-margin-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          Split the receipt
          <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
