"use client";

import { type FormEvent, useMemo, useState } from "react";
import { AnimatePresence, motion, Reorder } from "motion/react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Banknote,
  Calculator,
  Calendar,
  Check,
  ChevronDown,
  Coins,
  HatGlasses,
  ListChecks,
  Loader2,
  Pencil,
  Percent,
  Plus,
  TicketPercent,
  Users2,
  Wallet,
} from "lucide-react";
import { CurrencyPicker } from "@/components/ui/CurrencyPicker";
import { DatePicker } from "@/components/ui/DatePicker";
import { PersonChip } from "@/components/ui/PersonChip";
import { RateInput } from "@/components/ui/RateInput";
import { ExpenseLineItem } from "@/components/ui/ExpenseLineItem";
import { computeSplit } from "@/lib/calculations";
import { currency } from "@/lib/format";
import type { Contribution, Person, RateSetting, ExpenseItem, ExpenseMode } from "@/lib/types";

const zeroRate: RateSetting = { mode: "percent", value: 0 };

const collapseTransition = { duration: 0.2, ease: "easeInOut" as const };

interface StageExpenseProps {
  expenseName: string;
  onRenameExpense: (name: string) => void;
  people: Person[];
  /** The signed-in user's own id, if any - their person row is tied to their real account name, so it's locked from renaming here just like a claimed tab member. */
  viewerId?: string;
  anonymousPersonIds?: string[];
  inTab?: boolean;
  availableTabMembers?: { id: string; name: string }[];
  onAddTabMember: (params: { memberId?: string; newMemberName?: string }) => Promise<unknown>;
  mode: ExpenseMode;
  items: ExpenseItem[];
  date: string;
  currency: string;
  contributions: Contribution[];
  onSetMode: (mode: ExpenseMode) => void;
  onSetDate: (date: string) => void;
  onSetCurrency: (currency: string) => void;
  onAddItem: (item: ExpenseItem) => void;
  onUpdateItem: (item: ExpenseItem) => void;
  onRemoveItem: (id: string) => void;
  onReorderItems: (items: ExpenseItem[]) => void;
  onSetContribution: (personId: string, amount: RateSetting) => void;
  onAddPerson: () => void;
  onRenamePerson: (id: string, name: string) => void;
  /** Label for the bottom action button - "Split the expense" for a standalone expense, "Add to tab" when it's in (or about to join) a tab. */
  continueLabel: string;
  onContinue: () => void;
}

export function StageExpense({
  expenseName,
  onRenameExpense,
  people,
  viewerId,
  anonymousPersonIds = [],
  inTab = false,
  availableTabMembers = [],
  onAddTabMember,
  mode,
  items,
  date,
  currency: currencyCode,
  contributions,
  onSetMode,
  onSetDate,
  onSetCurrency,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onReorderItems,
  onSetContribution,
  onAddPerson,
  onRenamePerson,
  continueLabel,
  onContinue,
}: StageExpenseProps) {
  const allIds = useMemo(() => people.map((p) => p.id), [people]);

  // Items already present when this page mounts shouldn't play the
  // "just added" entrance animation - only ones added afterward should.
  const [initialItemIds] = useState(() => new Set(items.map((item) => item.id)));

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [discount, setDiscount] = useState<RateSetting>({ mode: "amount", value: 0 });
  const [tax, setTax] = useState<RateSetting>(zeroRate);
  const [tip, setTip] = useState<RateSetting>(zeroRate);
  const [splitWith, setSplitWith] = useState<string[]>(allIds);
  const [error, setError] = useState<string | null>(null);
  const [contributionsOpen, setContributionsOpen] = useState(() =>
    contributions.some((c) => c.amount.value > 0),
  );

  const totals = useMemo(() => computeSplit(people, items), [people, items]);

  function contributionFor(personId: string): RateSetting {
    return contributions.find((c) => c.personId === personId)?.amount ?? { mode: "amount", value: 0 };
  }

  function togglePerson(id: string) {
    setSplitWith((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  // A one-total item has no name of its own (it takes the expense's), so
  // there's nothing meaningful to carry between the two modes - just clear
  // the itemized entry form when switching into it.
  function handleModeChange(nextMode: ExpenseMode) {
    if (nextMode === mode) return;
    if (nextMode === "itemized") resetForm();
    onSetMode(nextMode);
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setCost("");
    setDiscount({ mode: "amount", value: 0 });
    setTax(zeroRate);
    setTip(zeroRate);
    setSplitWith(allIds);
    setError(null);
  }

  function startEdit(item: ExpenseItem) {
    setEditingId(item.id);
    setName(item.name);
    setCost(String(item.cost));
    setDiscount(item.discount);
    setTax(item.tax);
    setTip(item.tip);
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
    if (tax.value < 0) {
      setError("Tax can't be negative.");
      return;
    }
    if (tip.value < 0) {
      setError("Tip can't be negative.");
      return;
    }
    if (splitWith.length === 0) {
      setError("Pick who's sharing this item.");
      return;
    }
    const item: ExpenseItem = {
      id: editingId ?? crypto.randomUUID(),
      name: name.trim(),
      cost: parsedCost,
      discount,
      tax,
      tip,
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
      <div className="mb-6 flex items-center justify-end">
        <div className="flex items-center gap-2 text-brass">
          <span className="font-display text-sm font-semibold tracking-wide uppercase">
            The expense
          </span>
        </div>
      </div>

      <ExpenseTitle name={expenseName} onRename={onRenameExpense} />

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
              locked={inTab ? !anonymousPersonIds.includes(person.id) : person.id === viewerId}
              onRename={(name) => onRenamePerson(person.id, name)}
            />
          ))}
        </ul>
        {anonymousPersonIds.length > 0 && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-soft">
            <HatGlasses className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
            Anonymous members haven&rsquo;t signed up yet.
          </p>
        )}
        {!inTab && people.some((p) => p.id === viewerId) && (
          <p className="mt-3 text-xs text-ink-soft">
            Your name comes from your account - update it in Settings.
          </p>
        )}
        {inTab ? (
          <>
            <p className="mt-3 text-xs text-ink-soft">
              This expense is in a tab, so only anonymous people here can be renamed.
            </p>
            <AddTabPersonForm availableMembers={availableTabMembers} onAdd={onAddTabMember} />
          </>
        ) : (
          <button
            type="button"
            onClick={onAddPerson}
            className="mt-3 flex cursor-pointer items-center gap-1 text-xs font-medium text-forest hover:text-ink"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Add person
          </button>
        )}
      </div>

      <div className="rounded-lg border border-rule bg-surface p-5">
        <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-rule pb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 shrink-0 text-brass" strokeWidth={2.25} />
            <span className="font-display text-sm font-medium text-ink-soft">Date</span>
            <DatePicker value={date ?? ""} onChange={onSetDate} aria-label="Expense date" />
          </div>
          <div className="flex items-center gap-2">
            <Banknote className="h-4 w-4 shrink-0 text-brass" strokeWidth={2.25} />
            <span className="font-display text-sm font-medium text-ink-soft">Currency</span>
            <CurrencyPicker value={currencyCode} onChange={onSetCurrency} aria-label="Expense currency" />
          </div>
        </div>

        <div className="mb-4 flex gap-2 border-b border-rule pb-4">
          <ModeButton
            icon={Calculator}
            label="One total"
            active={mode === "simple"}
            onClick={() => handleModeChange("simple")}
          />
          <ModeButton
            icon={ListChecks}
            label="Itemized"
            active={mode === "itemized"}
            onClick={() => handleModeChange("itemized")}
          />
        </div>

        {mode === "simple" ? (
          <SimpleTotalForm
            expenseName={expenseName}
            people={people}
            anonymousPersonIds={anonymousPersonIds}
            item={items[0]}
            onSave={(item) => (items[0] ? onUpdateItem(item) : onAddItem(item))}
            onRemove={onRemoveItem}
          />
        ) : (
          <>
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

              <div className="flex flex-wrap gap-4">
                <RateInput label="Tax" icon={Percent} rate={tax} onChange={setTax} />
                <RateInput label="Tip" icon={Coins} rate={tip} onChange={setTip} />
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
                      Add to expense
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
                  <ExpenseLineItem
                    key={item.id}
                    item={item}
                    index={i}
                    people={people}
                    currency={currencyCode}
                    isEditing={item.id === editingId}
                    isNew={!initialItemIds.has(item.id)}
                    onEdit={() => startEdit(item)}
                    onRemove={() => handleRemove(item.id)}
                  />
                ))}
              </Reorder.Group>
            )}
          </>
        )}

        {mode === "itemized" && (
          <motion.div
            layout
            transition={{ layout: collapseTransition }}
            className="perforated-top mt-4 space-y-1 pt-4 text-sm"
          >
            <div className="flex justify-between text-ink-soft">
              <span>Subtotal</span>
              <span className="font-numeric">{currency(totals.subtotal, currencyCode)}</span>
            </div>
            <div className="flex justify-between text-ink-soft">
              <span>Tax</span>
              <span className="font-numeric">{currency(totals.taxTotal, currencyCode)}</span>
            </div>
            <div className="flex justify-between text-ink-soft">
              <span>Tip</span>
              <span className="font-numeric">{currency(totals.tipTotal, currencyCode)}</span>
            </div>
            <div className="flex justify-between pt-1 font-display text-base font-semibold text-ink">
              <span>Total</span>
              <span className="font-numeric">{currency(totals.grandTotal, currencyCode)}</span>
            </div>
          </motion.div>
        )}

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
          disabled={items.length === 0 || !expenseName.trim()}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-margin-red px-6 py-3 font-display font-semibold text-surface transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-margin-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          {continueLabel}
          <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

function ModeButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition ${
        active
          ? "border-forest bg-forest text-surface"
          : "border-rule text-ink-soft hover:border-forest hover:text-forest"
      }`}
    >
      <Icon className="h-4 w-4" strokeWidth={2.25} />
      {label}
    </button>
  );
}

function SimpleTotalForm({
  expenseName,
  people,
  anonymousPersonIds,
  item,
  onSave,
  onRemove,
}: {
  expenseName: string;
  people: Person[];
  anonymousPersonIds: string[];
  item?: ExpenseItem;
  onSave: (item: ExpenseItem) => void;
  onRemove: (id: string) => void;
}) {
  // A one-total item has no name of its own - it's always named after the
  // expense - so this form only needs to capture the amount.
  const [cost, setCost] = useState(item ? String(item.cost) : "");
  const [splitWith, setSplitWith] = useState<string[]>(item?.splitWith ?? people.map((p) => p.id));

  function commit(nextCost: string, nextSplitWith: string[]) {
    const parsed = Number(nextCost);
    if (!(parsed > 0)) {
      if (item) onRemove(item.id);
      return;
    }
    onSave({
      id: item?.id ?? crypto.randomUUID(),
      name: expenseName,
      cost: parsed,
      discount: zeroRate,
      tax: zeroRate,
      tip: zeroRate,
      splitWith: nextSplitWith,
    });
  }

  function handleCostChange(value: string) {
    setCost(value);
    commit(value, splitWith);
  }

  function toggleSplitWith(id: string) {
    const next = splitWith.includes(id) ? splitWith.filter((p) => p !== id) : [...splitWith, id];
    if (next.length === 0) return;
    setSplitWith(next);
    commit(cost, next);
  }

  return (
    <div className="space-y-3">
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={0.01}
        value={cost}
        onChange={(e) => handleCostChange(e.target.value)}
        placeholder="0.00"
        aria-label="Expense total"
        className="font-numeric w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-margin-red/40"
      />
      <div>
        <p className="mb-1.5 text-xs font-medium tracking-wide text-ink-soft uppercase">Split with</p>
        <div className="flex flex-wrap gap-2">
          {people.map((p) => (
            <PersonChip
              key={p.id}
              name={p.name}
              selected={splitWith.includes(p.id)}
              onToggle={() => toggleSplitWith(p.id)}
              anonymous={anonymousPersonIds.includes(p.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ExpenseTitle({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  // A brand-new expense has no name yet - there's nothing valid to show in
  // display mode, so it starts straight in the editing form.
  const [editing, setEditing] = useState(() => !name);
  const [value, setValue] = useState(name);

  function commit() {
    const trimmed = value.trim();
    if (trimmed) {
      onRename(trimmed);
      setEditing(false);
    } else if (name) {
      // Nothing typed - revert to the existing name rather than save blank.
      setValue(name);
      setEditing(false);
    }
    // Still no name at all: stay in editing mode, since a name is required.
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
          placeholder="Name this expense"
          required
          className="font-display w-full max-w-md rounded-md border border-rule bg-paper px-3 py-2 text-2xl font-semibold text-ink outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-margin-red/40"
        />
      </form>
    );
  }

  return (
    <div className="mb-6 flex items-center gap-2">
      <h1 className="font-display min-w-0 truncate text-2xl font-semibold text-ink">{name}</h1>
      <button
        type="button"
        onClick={() => {
          setValue(name);
          setEditing(true);
        }}
        aria-label="Rename expense"
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
  locked = false,
  onRename,
}: {
  person: Person;
  anonymous: boolean;
  locked?: boolean;
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
          <HatGlasses
            className="h-3.5 w-3.5 shrink-0 text-ink-soft"
            strokeWidth={2.25}
            aria-label="Anonymous member"
          />
        )}
      </span>
      {!locked && (
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
      )}
    </li>
  );
}

function AddTabPersonForm({
  availableMembers,
  onAdd,
}: {
  availableMembers: { id: string; name: string }[];
  onAdd: (params: { memberId?: string; newMemberName?: string }) => Promise<unknown>;
}) {
  const [adding, setAdding] = useState(false);
  const [selection, setSelection] = useState("__new__");
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setAdding(false);
    setSelection("__new__");
    setNewName("");
    setSubmitting(false);
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = newName.trim();
    if (selection === "__new__" && !trimmedName) {
      setError("Enter a name.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onAdd(selection === "__new__" ? { newMemberName: trimmedName } : { memberId: selection });
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add this person.");
      setSubmitting(false);
    }
  }

  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="mt-3 flex cursor-pointer items-center gap-1 text-xs font-medium text-forest hover:text-ink"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
        Add person
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2">
      <select
        value={selection}
        onChange={(e) => setSelection(e.target.value)}
        className="w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-margin-red/40"
      >
        <option value="__new__">Someone new</option>
        {availableMembers.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      {selection === "__new__" && (
        <input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Name"
          className="w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-margin-red/40"
        />
      )}
      {error && <p className="text-xs text-margin-red">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-forest px-3 py-1.5 text-xs font-semibold text-surface transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.5} />}
          Add
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={submitting}
          className="cursor-pointer text-xs font-medium text-ink-soft transition hover:text-margin-red disabled:cursor-not-allowed disabled:opacity-70"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
