import { type ReactNode, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
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
  StickyNote,
  TicketPercent,
  X,
  Trash2,
  Wallet,
} from "lucide-react";
import { MemberAvatar } from "@/components/MemberAvatar";
import { CurrencyPicker } from "@/components/ui/CurrencyPicker";
import { DatePicker } from "@/components/ui/DatePicker";
import { RateInput } from "@/components/ui/RateInput";
import { ExpenseLineItem } from "@/components/ui/ExpenseLineItem";
import { ExpenseImageField, type ReceiptSummary } from "@/components/ExpenseImageField";
import { computeSplit } from "@/lib/calculations";
import { currency } from "@/lib/format";
import type { Contribution, Person, RateSetting, ExpenseItem, ExpenseMode } from "@/lib/types";

const zeroRate: RateSetting = { mode: "percent", value: 0 };

const collapseTransition = { duration: 0.2, ease: "easeInOut" as const };

interface StageExpenseProps {
  expenseName: string;
  description?: string;
  headerAction?: ReactNode;
  tabField?: ReactNode;
  continueDisabled?: boolean;
  showPeople?: boolean;
  onCancel?: () => void;
  cancelLabel?: string;
  onRenameExpense: (name: string) => void;
  people: Person[];
  /** The signed-in user's own id, if any - their person row is tied to their real account name, so it's locked from renaming here just like a claimed tab member. */
  viewerId?: string;
  anonymousPersonIds?: string[];
  inTab?: boolean;
  mode: ExpenseMode;
  items: ExpenseItem[];
  date: string;
  currency: string;
  contributions: Contribution[];
  /** The expense's note, if it has one - a blank note is stored as no note at all. */
  note?: string;
  onSetNote: (note: string) => void;
  /** The expense's receipt, whether it's already in storage or a file still waiting on the expense's first save. */
  receipt?: ReceiptSummary;
  onPickReceipt: (file: File | null) => void | Promise<void>;
  /** Whether the viewer can upload a receipt - uploads are stored against an account, so guests can't. */
  canUploadImage: boolean;
  onSetMode: (mode: ExpenseMode) => void;
  onSetDate: (date: string) => void;
  onSetCurrency: (currency: string) => void;
  onAddItem: (item: ExpenseItem) => void;
  onUpdateItem: (item: ExpenseItem) => void;
  onRemoveItem: (id: string) => void;
  onSetContribution: (personId: string, amount: RateSetting) => void;
  onAddPerson: () => void;
  onRemovePerson: (id: string) => void;
  onRenamePerson: (id: string, name: string) => void;
  /** Label for the bottom action button - "Split the expense" for a standalone expense, "Add to tab" when it's in (or about to join) a tab. */
  continueLabel: string;
  /** May be async - a receipt picked before the expense was ever saved is uploaded here, on the way out. */
  onContinue: () => void | Promise<void>;
}

export function StageExpense({
  expenseName,
  description,
  headerAction,
  tabField,
  continueDisabled = false,
  showPeople = true,
  onCancel,
  cancelLabel = "Cancel",
  onRenameExpense,
  people,
  viewerId,
  anonymousPersonIds = [],
  inTab = false,
  mode,
  items,
  date,
  currency: currencyCode,
  contributions,
  note,
  onSetNote,
  receipt,
  onPickReceipt,
  canUploadImage,
  onSetMode,
  onSetDate,
  onSetCurrency,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onSetContribution,
  onAddPerson,
  onRemovePerson,
  onRenamePerson,
  continueLabel,
  onContinue,
}: StageExpenseProps) {
  const allIds = useMemo(() => people.map((p) => p.id), [people]);

  const [adjustmentsOpen, setAdjustmentsOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [addingItem, setAddingItem] = useState(items.length === 0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [discount, setDiscount] = useState<RateSetting>({ mode: "amount", value: 0 });
  const [tax, setTax] = useState<RateSetting>(zeroRate);
  const [tip, setTip] = useState<RateSetting>(zeroRate);
  const [splitWith, setSplitWith] = useState<string[]>(allIds);
  const [error, setError] = useState<string | null>(null);
  const [contributionsOpen, setContributionsOpen] = useState(true);
  const [continuing, setContinuing] = useState(false);
  const [continueError, setContinueError] = useState<string | null>(null);

  const totals = useMemo(() => computeSplit(people, items), [people, items]);

  // Finalizing can do real work before it lands - uploading a receipt the
  // draft has been holding onto - so the button waits on it and surfaces
  // whatever fails instead of looking like nothing happened.
  async function handleContinue() {
    setContinueError(null);
    if (mode === "itemized" && (editingId || (addingItem && (name.trim() || cost)))) {
      setContinueError("Finish or cancel the open item before saving the expense.");
      return;
    }
    setContinuing(true);
    try {
      await onContinue();
    } catch (err) {
      setContinueError(err instanceof Error ? err.message : "Couldn't save this expense.");
    } finally {
      setContinuing(false);
    }
  }

  function contributionFor(personId: string): RateSetting {
    return contributions.find((c) => c.personId === personId)?.amount ?? { mode: "amount", value: 0 };
  }

  function togglePerson(id: string) {
    setSplitWith((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  function handleRemovePerson(id: string) {
    const remainingIds = allIds.filter((personId) => personId !== id);
    setSplitWith((previous) => {
      const filtered = previous.filter((personId) => personId !== id);
      return filtered.length > 0 ? filtered : remainingIds;
    });
    onRemovePerson(id);
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
    setAdjustmentsOpen(false);
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
    setAdjustmentsOpen(item.discount.value > 0 || item.tax.value > 0 || item.tip.value > 0);
    setAddingItem(false);
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
    setAddingItem(false);
  }

  const expenseMetadata = (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 [&_button]:min-h-11">
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
  );
  const peopleManagement = showPeople && !inTab ? (
    <div className="mt-3 border-t border-rule pt-2">
      <button
        type="button"
        onClick={() => setPeopleOpen((o) => !o)}
        aria-expanded={peopleOpen}
        className="flex min-h-11 w-full items-center justify-between gap-2 py-3 text-sm font-medium text-forest"
      >
        Manage people
        <motion.span
          animate={{ rotate: peopleOpen ? 180 : 0 }}
          transition={collapseTransition}
          className="shrink-0"
        >
          <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {peopleOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={collapseTransition}
            className="overflow-hidden"
          >
            <div className="pb-1">
              <ul className="flex flex-wrap gap-2 text-sm">
                {people.map((person) => (
                  <PersonRow
                    key={person.id}
                    person={person}
                    anonymous={anonymousPersonIds.includes(person.id)}
                    locked={person.id === viewerId}
                    removable={people.length > 1}
                    onRemove={() => handleRemovePerson(person.id)}
                    onRename={(name) => onRenamePerson(person.id, name)}
                  />
                ))}
              </ul>
              {people.some((p) => p.id === viewerId) && (
                <p className="mt-3 text-xs text-ink-soft">
                  Your name comes from your account - update it in Settings.
                </p>
              )}
              <button
                type="button"
                onClick={onAddPerson}
                className="mt-3 flex min-h-11 items-center gap-1 text-sm font-medium text-forest hover:text-ink"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                Add person
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  ) : null;

  const itemEditor = (
    <div className="grid gap-5 md:grid-cols-2 md:gap-6">
      <div className="min-w-0">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
          <label className="min-w-0 text-sm text-ink">Item name
            <input autoFocus type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Nachos" className="mt-1 min-h-11 w-full min-w-0 rounded-md border border-rule bg-paper px-3 py-2" />
          </label>
          <label className="min-w-0 text-sm text-ink">Amount · {currencyCode}
            <input type="number" inputMode="decimal" min={0} step={0.01} value={cost} onChange={e => setCost(e.target.value)} placeholder="0.00" className="font-numeric mt-1 min-h-11 w-full min-w-0 rounded-md border border-rule bg-paper px-3 py-2" />
          </label>
        </div>
        <details key={editingId ?? "new"} open={adjustmentsOpen} onToggle={event => setAdjustmentsOpen(event.currentTarget.open)} className="group/adjustments mt-3">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm text-ink-soft [&::-webkit-details-marker]:hidden"><span>Discount, tax &amp; tip{discount.value || tax.value || tip.value ? " · Applied" : ""}</span><ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 transition-transform group-open/adjustments:rotate-180" strokeWidth={2.5} /></summary>
          <div className="flex flex-wrap gap-4 [&>div]:flex-wrap">
            <RateInput wide label="Discount" icon={TicketPercent} rate={discount} onChange={setDiscount} />
            <RateInput wide label="Tax" icon={Percent} rate={tax} onChange={setTax} />
            <RateInput wide label="Tip" icon={Coins} rate={tip} onChange={setTip} />
          </div>
          <p className="mt-2 text-xs text-ink-soft">Discount applies before tax and tip.</p>
        </details>
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-medium text-ink">Split this item</h3>
        <p className="mt-1 text-xs text-ink-soft">Equally among selected people</p>
        {people.map(person => <label key={person.id} className="flex min-h-11 cursor-pointer items-center gap-3 py-2 text-sm text-ink">
          <input type="checkbox" checked={splitWith.includes(person.id)} onChange={() => togglePerson(person.id)} className="h-5 w-5 shrink-0 accent-forest" />
          <MemberAvatar id={person.id} name={person.name} />
          <span className="min-w-0 break-words">{person.name}</span>
          {anonymousPersonIds.includes(person.id) && <HatGlasses className="h-4 w-4 shrink-0 text-ink-soft" aria-label="Anonymous member" />}
        </label>)}
      </div>
      {error && <p role="alert" className="text-sm text-margin-red md:col-span-2">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2">
        <button type="button" onClick={() => { resetForm(); setAddingItem(false); }} className="min-h-11 text-sm text-ink-soft">Cancel item changes</button>
        <button type="button" onClick={handleSubmit} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-forest px-4 py-2 text-sm font-medium text-forest hover:bg-paper">
          {editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{editingId ? "Done with item" : "Add to expense"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="w-full [&_input]:text-base [&_textarea]:text-base sm:[&_input]:text-sm sm:[&_textarea]:text-sm">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1"><ExpenseTitle name={expenseName} onRename={onRenameExpense} />
          {tabField}
          {description && <p className="mt-2 text-sm text-ink-soft">{description}</p>}
        </div>
        {headerAction}
      </header>

      <div className="rounded-xl border border-rule/70 bg-surface/80 p-5 sm:p-6">
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

        <section aria-label="Expense details" className="mb-5 border-b border-rule pb-5">
          {expenseMetadata}
        </section>

        {mode === "simple" ? (
          <SimpleTotalForm
            key={people.map(person => person.id).join(",")}
            expenseName={expenseName}
            peopleManagement={peopleManagement}
            currencyCode={currencyCode}
            people={people}
            anonymousPersonIds={anonymousPersonIds}
            item={items[0]}
            onSave={(item) => (items[0] ? onUpdateItem(item) : onAddItem(item))}
            onRemove={onRemoveItem}
          />
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium text-ink">Items <span className="text-ink-soft">({items.length})</span></h2>
              <button type="button" onClick={() => { resetForm(); setAddingItem(true); }} className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-forest"><Plus className="h-4 w-4" />Add item</button>
            </div>
            {addingItem && <div className="mt-2 rounded-lg border border-rule p-4"><h3 className="mb-3 text-sm font-medium text-ink">New item</h3>{itemEditor}</div>}

            {items.length > 0 && (
              <ul
                className="mt-2 space-y-3"
              >
                {items.map((item, i) => (
                  <ExpenseLineItem
                    key={item.id}
                    item={item}
                    index={i}
                    people={people}
                    currency={currencyCode}
                    isEditing={item.id === editingId}
                    onEdit={() => startEdit(item)}
                    onRemove={() => handleRemove(item.id)}
                  >
                    {editingId === item.id && itemEditor}
                  </ExpenseLineItem>
                ))}
              </ul>
            )}
            <div className="mt-5 grid gap-5 border-t border-rule pt-5 md:grid-cols-2 md:gap-6">
              <section className="min-w-0">
                <h2 className="text-sm font-medium text-ink">Total amount <span className="text-ink-soft">({currencyCode})</span></h2>
                <p className="font-numeric mt-2 break-words text-3xl text-ink">{currency(totals.grandTotal, currencyCode)}</p>
                <p className="mt-1 text-xs text-ink-soft">Calculated from {items.length} {items.length === 1 ? "item" : "items"}</p>
                {(totals.taxTotal > 0 || totals.tipTotal > 0) && <dl className="mt-4 space-y-2 border-t border-rule pt-3 text-sm text-ink-soft">
                  <div className="flex justify-between gap-3"><dt>{items.some(item => item.discount.value > 0) ? "Subtotal after discounts" : "Subtotal"}</dt><dd className="font-numeric">{currency(totals.subtotal, currencyCode)}</dd></div>
                  {totals.taxTotal > 0 && <div className="flex justify-between gap-3"><dt>Tax</dt><dd className="font-numeric">{currency(totals.taxTotal, currencyCode)}</dd></div>}
                  {totals.tipTotal > 0 && <div className="flex justify-between gap-3"><dt>Tip</dt><dd className="font-numeric">{currency(totals.tipTotal, currencyCode)}</dd></div>}
                </dl>}
              </section>
              <section className="min-w-0 border-t border-rule pt-5 md:border-t-0 md:border-l md:pt-0 md:pl-6">
                <h2 className="text-sm font-medium text-ink">Split summary</h2>
                <p className="mt-1 text-xs text-ink-soft">Based on each item’s split</p>
                <ul className="divide-y divide-rule">
                  {totals.people.map(person => <li key={person.personId} className="flex min-h-14 items-center gap-3 py-3 text-sm">
                    <MemberAvatar id={person.personId} name={person.name} />
                    <span className="min-w-0 flex-1 break-words text-ink">{person.name}</span>
                    {anonymousPersonIds.includes(person.personId) && <HatGlasses className="h-4 w-4 shrink-0 text-ink-soft" aria-label="Anonymous member" />}
                    <span className="font-numeric text-ink">{currency(person.total, currencyCode)}</span>
                  </li>)}
                </ul>
                {peopleManagement}
              </section>
            </div>
          </>
        )}

        <div className="mt-4 rounded-md border border-rule transition has-[button:hover]:border-forest">
          <button
            type="button"
            onClick={() => setContributionsOpen((o) => !o)}
            aria-expanded={contributionsOpen}
            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-ink"
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
                    <div key={p.id} className="flex flex-wrap items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2"><MemberAvatar id={p.id} name={p.name} /><span className="truncate text-sm text-ink">{p.name}</span></span>
                      <RateInput
                        label={`${p.name} contribution`}
                        icon={Wallet}
                        rate={contributionFor(p.id)}
                        onChange={(rate) => onSetContribution(p.id, rate)}
                        hideLabel
                        wide
                      />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <NoteField note={note} onSetNote={onSetNote} />
        <ExpenseImageField receipt={receipt} onPick={onPickReceipt} canUpload={canUploadImage} />
        {continueError && <p role="alert" className="mt-4 text-sm text-margin-red">{continueError}</p>}

      <div className="mt-6 flex flex-col-reverse gap-2 border-t border-rule pt-5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        {onCancel ? <button type="button" onClick={onCancel} className="min-h-11 rounded-lg px-1 py-3 text-sm font-medium text-ink-soft hover:text-forest">{cancelLabel}</button> : <span />}
        <button
          type="button"
          onClick={handleContinue}
          disabled={continueDisabled || items.length === 0 || !expenseName.trim() || continuing}
          aria-busy={continuing}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-forest sm:w-auto px-6 py-3 font-display font-semibold text-surface transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          {continueLabel}
          {continuing ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
          ) : (
            <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
          )}
        </button>
      </div>
      </div>
    </div>
  );
}

function NoteField({ note, onSetNote }: { note?: string; onSetNote: (note: string) => void }) {
  const [open, setOpen] = useState(() => !!note);
  const [draft, setDraft] = useState(note ?? "");
  const [syncedNote, setSyncedNote] = useState(note ?? "");

  // The stored note can change out from under this field - a Convex live
  // query landing, or another device editing the same expense - so adopt the
  // new value whenever it differs from the one this draft was seeded with.
  if ((note ?? "") !== syncedNote) {
    setSyncedNote(note ?? "");
    setDraft(note ?? "");
  }

  // Typing is kept local and only saved on blur, so a note costs one write
  // instead of one per keystroke. A blank note deletes it (see the reducer).
  function commit() {
    if (draft.trim() !== (note ?? "").trim()) onSetNote(draft);
  }

  function handleRemove() {
    setDraft("");
    onSetNote("");
  }

  return (
    <div className="mt-4 rounded-md border border-rule transition has-[button:hover]:border-forest">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-ink"
      >
        <span className="flex items-center gap-1.5">
          <StickyNote className="h-4 w-4 text-brass" strokeWidth={2.25} />
          {note ? "Note" : "Add a note"}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={collapseTransition}
          className="shrink-0"
        >
          <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={collapseTransition}
            className="overflow-hidden border-t border-rule"
          >
            <div className="space-y-2 px-4 py-3">
              <p className="text-xs text-ink-soft">
                Optional — anything worth remembering about this expense.
              </p>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                rows={3}
                placeholder="e.g. Dan covered the cab home, settle that separately."
                aria-label="Expense note"
                className="w-full resize-y rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-margin-red/40"
              />
              {note && (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="flex items-center gap-1 text-xs font-medium text-ink-soft transition hover:text-margin-red"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                  Delete note
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
      className={`inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition ${
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
  peopleManagement,
  currencyCode,
  people,
  anonymousPersonIds,
  item,
  onSave,
  onRemove,
}: {
  expenseName: string;
  peopleManagement: ReactNode;
  currencyCode: string;
  description?: string;
  headerAction?: ReactNode;
  tabField?: ReactNode;
  continueDisabled?: boolean;
  showPeople?: boolean;
  onCancel?: () => void;
  cancelLabel?: string;
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
    <div className="grid gap-5 md:grid-cols-2 md:gap-6">
      <div className="min-w-0">
      <label htmlFor="expense-total" className="mb-2 block text-sm font-medium text-ink">Total amount <span className="text-ink-soft">({currencyCode})</span></label>
      <input
        id="expense-total"
        type="number"
        inputMode="decimal"
        min={0}
        step={0.01}
        value={cost}
        onChange={(e) => handleCostChange(e.target.value)}
        placeholder="0.00"
        aria-label="Expense total"
        className="font-numeric min-h-16 w-full min-w-0 rounded-md border border-rule bg-paper px-3 py-3 text-3xl! text-ink outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-margin-red/40"
      />
      </div>
      <div className="min-w-0 border-t border-rule pt-5 md:border-t-0 md:border-l md:pt-0 md:pl-6">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-ink">Split with</h2>
          <span className="text-sm text-ink-soft">Equally</span>
        </div>
        <p className="mb-2 text-xs text-ink-soft">{splitWith.length} {splitWith.length === 1 ? "person" : "people"} selected</p>
        <div className="divide-y divide-rule">
          {people.map((p) => (
            <label key={p.id} className="flex min-h-14 cursor-pointer items-center gap-3 py-3 text-sm text-ink">
              <input type="checkbox" checked={splitWith.includes(p.id)} onChange={() => toggleSplitWith(p.id)} className="h-5 w-5 shrink-0 accent-forest" />
              <MemberAvatar id={p.id} name={p.name} />
              <span className="min-w-0 flex-1 break-words">{p.name}</span>
              {anonymousPersonIds.includes(p.id) && <HatGlasses className="h-4 w-4 shrink-0 text-ink-soft" aria-label="Anonymous member" />}
              <span className="font-numeric shrink-0">{splitWith.includes(p.id) ? currency((Number(cost) || 0) / Math.max(1, splitWith.length), currencyCode) : "—"}</span>
            </label>
          ))}
        </div>
        {peopleManagement}
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
      >
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          placeholder="Name this expense"
          required
          className="font-display w-full max-w-md rounded-md border border-rule bg-paper px-3 py-2 text-2xl! font-semibold text-ink outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-margin-red/40"
        />
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <h1 className="font-display min-w-0 break-words text-3xl font-semibold text-ink">{name}</h1>
      <button
        type="button"
        onClick={() => {
          setValue(name);
          setEditing(true);
        }}
        aria-label="Rename expense"
        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md p-1.5 text-ink-soft transition hover:text-forest"
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
  removable = false,
  onRemove,
  onRename,
}: {
  person: Person;
  anonymous: boolean;
  locked?: boolean;
  removable?: boolean;
  onRemove: () => void;
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
    <li className="flex max-w-full items-center justify-between gap-2 rounded-full border border-rule bg-paper px-4 py-2">
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
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md p-1.5 text-ink-soft transition hover:text-forest"
        >
          <Pencil className="h-3.5 w-3.5" strokeWidth={2.25} />
        </button>
      )}
      {removable && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${person.name} from this expense`}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md p-1.5 text-ink-soft transition hover:text-margin-red"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      )}
    </li>
  );
}
