"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Coins,
  Percent,
  Plus,
  Receipt,
  TicketPercent,
  Trash2,
} from "lucide-react";
import { PersonChip } from "@/components/ui/PersonChip";
import { RateInput } from "@/components/ui/RateInput";
import { computeSplit } from "@/lib/calculations";
import type { Person, RateSetting, ReceiptItem } from "@/lib/types";

interface StageReceiptProps {
  people: Person[];
  items: ReceiptItem[];
  tax: RateSetting;
  tip: RateSetting;
  onSetTax: (rate: RateSetting) => void;
  onSetTip: (rate: RateSetting) => void;
  onAddItem: (item: ReceiptItem) => void;
  onRemoveItem: (id: string) => void;
  onBack: () => void;
  onContinue: () => void;
}

function currency(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function StageReceipt({
  people,
  items,
  tax,
  tip,
  onSetTax,
  onSetTip,
  onAddItem,
  onRemoveItem,
  onBack,
  onContinue,
}: StageReceiptProps) {
  const allIds = useMemo(() => people.map((p) => p.id), [people]);

  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [discount, setDiscount] = useState("");
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

  function handleAdd() {
    const parsedCost = Number(cost);
    const parsedDiscount = discount ? Number(discount) : 0;
    if (!name.trim()) {
      setError("Give the item a name.");
      return;
    }
    if (!parsedCost || parsedCost <= 0) {
      setError("Enter a cost greater than $0.");
      return;
    }
    if (parsedDiscount < 0) {
      setError("Discount can't be negative.");
      return;
    }
    if (splitWith.length === 0) {
      setError("Pick who's sharing this item.");
      return;
    }
    onAddItem({
      id: crypto.randomUUID(),
      name: name.trim(),
      cost: parsedCost,
      discount: parsedDiscount,
      taxed: effectiveTaxed,
      tipped: effectiveTipped,
      splitWith,
    });
    setName("");
    setCost("");
    setDiscount("");
    setSplitWith(allIds);
    setError(null);
  }

  function personName(id: string): string {
    return people.find((p) => p.id === id)?.name ?? "?";
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
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

        <div className="space-y-3">
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
            <label className="mb-1 flex items-center gap-1 text-xs font-medium tracking-wide text-ink-soft uppercase">
              <TicketPercent className="h-3.5 w-3.5" strokeWidth={2.25} />
              Discount, before tax &amp; tip
            </label>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="0.00"
              aria-label="Discount amount"
              className="font-numeric w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-margin-red/40 sm:w-28"
            />
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

          <button
            type="button"
            onClick={handleAdd}
            className="inline-flex items-center gap-1.5 rounded-md bg-forest px-4 py-2 text-sm font-semibold text-surface transition hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Add to receipt
          </button>
        </div>

        {items.length > 0 && (
          <ul className="perforated-top mt-5 space-y-2 pt-4">
            {items.map((item, i) => (
              <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="text-ink">
                    <span className="font-numeric text-ink-soft">{i + 1}.</span> {item.name}
                  </p>
                  <p className="truncate text-xs text-ink-soft">
                    {item.taxed && "taxed"}
                    {item.taxed && item.tipped && " · "}
                    {item.tipped && "tipped"}
                    {(item.taxed || item.tipped) && " · "}
                    {item.splitWith.length === people.length
                      ? "everyone"
                      : item.splitWith.map(personName).join(", ")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-numeric text-ink">
                    {item.discount > 0 ? (
                      <>
                        <span className="text-ink-soft line-through">{currency(item.cost)}</span>{" "}
                        {currency(Math.max(0, item.cost - item.discount))}
                      </>
                    ) : (
                      currency(item.cost)
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.id)}
                    aria-label={`Remove ${item.name}`}
                    className="text-ink-soft transition hover:text-margin-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={2.25} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="perforated-top mt-4 space-y-1 pt-4 text-sm">
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
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onContinue}
          disabled={items.length === 0}
          className="inline-flex items-center gap-2 rounded-full bg-margin-red px-6 py-3 font-display font-semibold text-surface transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-margin-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          Split the receipt
          <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
