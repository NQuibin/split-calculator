"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, Reorder } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  Coins,
  Loader2,
  Pencil,
  Percent,
  Plus,
  TicketPercent,
  Users2,
  VenetianMask,
  Wallet,
} from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";
import { PersonChip } from "@/components/ui/PersonChip";
import { RateInput } from "@/components/ui/RateInput";
import { ReceiptLineItem } from "@/components/ui/ReceiptLineItem";
import { computeSplit } from "@/lib/calculations";
import { currency } from "@/lib/format";
import { receiptLabel } from "@/lib/receiptLabel";
import type { Contribution, Person, RateSetting, ReceiptItem } from "@/lib/types";

const collapseTransition = { duration: 0.2, ease: "easeInOut" as const };

interface StageReceiptProps {
  receiptName?: string;
  onRenameReceipt: (name: string | undefined) => void;
  people: Person[];
  anonymousPersonIds?: string[];
  items: ReceiptItem[];
  tax: RateSetting;
  tip: RateSetting;
  date: string;
  contributions: Contribution[];
  onSetTax: (rate: RateSetting) => void;
  onSetTip: (rate: RateSetting) => void;
  onSetDate: (date: string) => void;
  onAddItem: (item: ReceiptItem) => void;
  onUpdateItem: (item: ReceiptItem) => void;
  onRemoveItem: (id: string) => void;
  onReorderItems: (items: ReceiptItem[]) => void;
  onSetContribution: (personId: string, amount: RateSetting) => void;
  onAddPerson: () => void;
  onRenamePerson: (id: string, name: string) => void;
  onBack: () => void;
  onContinue: () => void;
  navigating?: boolean;
}

export function StageReceipt({
  receiptName,
  onRenameReceipt,
  people,
  anonymousPersonIds = [],
  items,
  tax,
  tip,
  date,
  contributions,
  onSetTax,
  onSetTip,
  onSetDate,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onReorderItems,
  onSetContribution,
  onAddPerson,
  onRenamePerson,
  onBack,
  onContinue,
  navigating = false,
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
  const [contributionsOpen, setContributionsOpen] = useState(() =>
    contributions.some((c) => c.amount.value > 0),
  );

  const totals = useMemo(() => computeSplit(people, items, tax, tip), [people, items, tax, tip]);

  function contributionFor(personId: string): RateSetting {
    return contributions.find((c) => c.personId === personId)?.amount ?? { mode: "amount", value: 0 };
  }

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
          disabled={navigating}
          aria-busy={navigating}
          className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-ink-soft transition hover:text-forest disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
        >
          {navigating ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
          ) : (
            <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
          )}
          {people.length} people
        </button>
        <div className="flex items-center gap-2 text-brass">
          <span className="font-display text-sm font-semibold tracking-wide uppercase">
            The receipt
          </span>
        </div>
      </div>

      <ReceiptTitle name={receiptName} defaultName={receiptLabel(undefined, people)} onRename={onRenameReceipt} />

      <div className="mb-4 rounded-lg border border-rule bg-surface p-5">
        <p className="mb-3 flex items-center gap-1.5 font-display text-sm font-semibold tracking-wide text-ink uppercase">
          <Users2 className="h-4 w-4 text-brass" strokeWidth={2.25} />
          People
        </p>
        <ul className="space-y-2 text-sm">
          {people.map((person) => (
            <PersonRow
              key={person.id}
              person={person}
              anonymous={anonymousPersonIds.includes(person.id)}
              onRename={(name) => onRenamePerson(person.id, name)}
            />
          ))}
        </ul>
        {anonymousPersonIds.length > 0 && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-soft">
            <VenetianMask className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
            Anonymous members haven&rsquo;t signed up yet.
          </p>
        )}
        <button
          type="button"
          onClick={onAddPerson}
          className="mt-3 flex cursor-pointer items-center gap-1 text-xs font-medium text-forest hover:text-ink"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          Add person
        </button>
      </div>

      <div className="rounded-lg border border-rule bg-surface p-5">
        <div className="mb-4 flex items-center gap-2 border-b border-rule pb-4">
          <Calendar className="h-4 w-4 shrink-0 text-brass" strokeWidth={2.25} />
          <span className="font-display text-sm font-medium text-ink-soft">Date</span>
          <DatePicker value={date ?? ""} onChange={onSetDate} aria-label="Receipt date" />
        </div>

        <div className="mb-4 flex flex-wrap gap-4 border-b border-rule pb-4">
          <RateInput label="Tax" icon={Percent} rate={tax} onChange={onSetTax} />
          <RateInput label="Tip" icon={Coins} rate={tip} onChange={onSetTip} />
        </div>

        <motion.div
          layout
          transition={{ layout: collapseTransition }}
          className={`relative space-y-3 transition-[margin,padding,box-shadow] duration-200 ease-in-out ${
            editingId ? "-m-3 rounded-md p-3 ring-2 ring-brass" : ""
          }`}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {editingId && (
              <motion.div
                key="editing-banner"
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={collapseTransition}
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
                  anonymous={anonymousPersonIds.includes(p.id)}
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
            transition={{ layout: collapseTransition }}
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
          transition={{ layout: collapseTransition }}
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

        <div className="mt-4 rounded-md border border-rule transition has-[button:hover]:border-forest">
          <button
            type="button"
            onClick={() => setContributionsOpen((o) => !o)}
            aria-expanded={contributionsOpen}
            className="flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-ink"
          >
            <span className="flex items-center gap-1.5">
              <Wallet className="h-4 w-4 text-brass" strokeWidth={2.25} />
              Who&rsquo;s paid so far
            </span>
            <motion.span
              animate={{ rotate: contributionsOpen ? 180 : 0 }}
              transition={collapseTransition}
              className="shrink-0"
            >
              <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {contributionsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={collapseTransition}
                className="overflow-hidden border-t border-rule"
              >
                <div className="space-y-3 px-4 py-3">
                  <p className="text-xs text-ink-soft">
                    Optional — record what each person already paid, so the split below can show
                    who&rsquo;s owed money back.
                  </p>
                  {people.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm text-ink">{p.name}</span>
                      <RateInput
                        label={`${p.name} contribution`}
                        icon={Wallet}
                        rate={contributionFor(p.id)}
                        onChange={(rate) => onSetContribution(p.id, rate)}
                        hideLabel
                      />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
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

function ReceiptTitle({
  name,
  defaultName,
  onRename,
}: {
  name?: string;
  defaultName: string;
  onRename: (name: string | undefined) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name ?? "");

  function commit() {
    onRename(value.trim() || undefined);
    setEditing(false);
  }

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          commit();
        }}
        className="mb-6"
      >
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          placeholder={defaultName}
          className="font-display w-full max-w-md rounded-md border border-rule bg-paper px-3 py-2 text-2xl font-semibold text-ink outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-margin-red/40"
        />
      </form>
    );
  }

  return (
    <div className="mb-6 flex items-center gap-2">
      <h1 className="font-display min-w-0 truncate text-2xl font-semibold text-ink">{name || defaultName}</h1>
      <button
        type="button"
        onClick={() => {
          setValue(name ?? "");
          setEditing(true);
        }}
        aria-label="Rename receipt"
        className="shrink-0 cursor-pointer rounded-md p-1.5 text-ink-soft transition hover:text-forest"
      >
        <Pencil className="h-4 w-4" strokeWidth={2.25} />
      </button>
    </div>
  );
}

function PersonRow({
  person,
  anonymous,
  onRename,
}: {
  person: Person;
  anonymous: boolean;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(person.name);

  function commit() {
    const trimmed = value.trim();
    if (trimmed && trimmed !== person.name) onRename(trimmed);
    setEditing(false);
  }

  if (editing) {
    return (
      <li>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            commit();
          }}
        >
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            className="w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-margin-red/40"
          />
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 truncate text-ink">
        {person.name}
        {anonymous && (
          <VenetianMask
            className="h-3.5 w-3.5 shrink-0 text-ink-soft"
            strokeWidth={2.25}
            aria-label="Anonymous member"
          />
        )}
      </span>
      <button
        type="button"
        onClick={() => {
          setValue(person.name);
          setEditing(true);
        }}
        aria-label={`Rename ${person.name}`}
        className="shrink-0 cursor-pointer rounded-md p-1.5 text-ink-soft transition hover:text-forest"
      >
        <Pencil className="h-3.5 w-3.5" strokeWidth={2.25} />
      </button>
    </li>
  );
}
