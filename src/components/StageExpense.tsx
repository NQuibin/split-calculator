import { type ReactNode, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Asterisk,
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
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label, Textarea } from "@/components/ui/Input";
import { CurrencyPicker } from "@/components/ui/CurrencyPicker";
import { DatePicker } from "@/components/ui/DatePicker";
import { RateInput } from "@/components/ui/RateInput";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/Dialog";
import { ExpenseLineItem } from "@/components/ui/ExpenseLineItem";
import { MenuOption } from "@/components/ui/MenuOption";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { ExpenseImageField, type ReceiptSummary } from "@/components/ExpenseImageField";
import { computeSplit, hasIndividualAdjustments, resolveItemAdjustments } from "@/lib/calculations";
import { currency } from "@/lib/format";
import { isUpcoming } from "@/lib/format";
import type { ExpenseAdjustments, Person, RateSetting, ExpenseItem, ExpenseMode } from "@/lib/types";
import { GroupTitle, PageDescription, PageTitle } from "@/components/ui/Typography";
import { ExpenseBalances } from "@/components/ExpenseBalances";
import { MemberSelectionRow } from "@/components/ui/MemberSelectionRow";

const zeroAdjustments: ExpenseAdjustments = { discount: { mode: "amount", value: 0 }, tax: { mode: "percent", value: 0 }, tip: { mode: "percent", value: 0 } };

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
  globalAdjustments?: ExpenseAdjustments;
  onSetGlobalAdjustments: (adjustments: ExpenseAdjustments) => void;
  date: string;
  currency: string;
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
  payerId?: string;
  onSetPayer: (payerId: string | undefined) => void;
  onAddItem: (item: ExpenseItem) => void;
  onUpdateItem: (item: ExpenseItem) => void;
  onRemoveItem: (id: string) => void;
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
  globalAdjustments = zeroAdjustments,
  onSetGlobalAdjustments,
  date,
  currency: currencyCode,
  note,
  onSetNote,
  receipt,
  onPickReceipt,
  canUploadImage,
  onSetMode,
  onSetDate,
  onSetCurrency,
  payerId,
  onSetPayer,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onAddPerson,
  onRemovePerson,
  onRenamePerson,
  continueLabel,
  onContinue,
}: StageExpenseProps) {
  const allIds = useMemo(() => people.map((p) => p.id), [people]);

  const [adjustmentsOpen, setAdjustmentsOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [payerOpen, setPayerOpen] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [discount, setDiscount] = useState<RateSetting>({ mode: "amount", value: 0 });
  const [tax, setTax] = useState<RateSetting>(zeroRate);
  const [tip, setTip] = useState<RateSetting>(zeroRate);
  const [splitWith, setSplitWith] = useState<string[]>(allIds);
  const [error, setError] = useState<string | null>(null);
  const [continuing, setContinuing] = useState(false);
  const [continueError, setContinueError] = useState<string | null>(null);
  const [payerError, setPayerError] = useState<string | null>(null);

  const resolvedItems = useMemo(() => resolveItemAdjustments(items, globalAdjustments), [items, globalAdjustments]);
  const totals = useMemo(() => computeSplit(people, items, globalAdjustments), [people, items, globalAdjustments]);

  // Finalizing can do real work before it lands - uploading a receipt the
  // draft has been holding onto - so the button waits on it and surfaces
  // whatever fails instead of looking like nothing happened.
  async function handleContinue() {
    setContinueError(null);
    if (!payerId || !people.some((person) => person.id === payerId)) {
      const message = "Choose who paid for this expense before saving.";
      setPayerError(message);
      setContinueError(message);
      return;
    }
    setPayerError(null);
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
    closeItemEditor();
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

  function closeItemEditor() {
    resetForm();
    setAddingItem(false);
  }

  function startEdit(item: ExpenseItem) {
    setAdjustmentsOpen(hasIndividualAdjustments(item));
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
    if (adjustmentsOpen && discount.value < 0) {
      setError("Discount can't be negative.");
      return;
    }
    if (adjustmentsOpen && tax.value < 0) {
      setError("Tax can't be negative.");
      return;
    }
    if (adjustmentsOpen && tip.value < 0) {
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
      overrideAdjustments: adjustmentsOpen,
    };
    if (editingId) {
      onUpdateItem(item);
    } else {
      onAddItem(item);
    }
    closeItemEditor();
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
          <div className="basis-full border-t border-rule pt-3">
            <Label id="expense-payer-label" htmlFor="expense-payer">{isUpcoming(date) ? "Will be paid by" : "Paid by"} <span aria-hidden="true">*</span></Label>
            <Popover open={payerOpen} onOpenChange={setPayerOpen}>
              <PopoverTrigger
                render={
                  <Button
                    id="expense-payer"
                    variant="field"
                    aria-labelledby="expense-payer-label expense-payer-value"
                    aria-required="true"
                    aria-invalid={payerError ? "true" : undefined}
                    aria-describedby={payerError ? "expense-payer-help expense-payer-error" : "expense-payer-help"}
                    className="group mt-1 min-h-11 w-full max-w-md justify-between rounded-md px-3 py-2"
                  />
                }
              >
                <span id="expense-payer-value" className="truncate">
                  {people.find((person) => person.id === payerId)?.name ?? "Select a payer"}
                </span>
                <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-soft chevron-flip" />
              </PopoverTrigger>
              <PopoverContent align="start" className="w-80 max-w-[calc(100vw-3rem)] rounded-lg p-2">
                <ul className="max-h-64 space-y-0.5 overflow-y-auto">
                  {people.map((person) => (
                    <li key={person.id}>
                      <MenuOption
                        selected={person.id === payerId}
                        onClick={() => {
                          setPayerError(null);
                          setContinueError(null);
                          onSetPayer(person.id);
                          setPayerOpen(false);
                        }}
                      >
                        <span className="truncate">{person.name}</span>
                      </MenuOption>
                    </li>
                  ))}
                </ul>
              </PopoverContent>
            </Popover>
            <p id="expense-payer-help" className="mt-2 text-xs text-ink-soft">{people.find((person) => person.id === payerId)
              ? `${people.find((person) => person.id === payerId)!.name} ${isUpcoming(date) ? "will pay" : "paid"} the full expense. They can pay without being in the split.`
              : "Required before saving. Choose who covers the full expense. They can pay without being in the split."}</p>
            {payerError && <FieldError id="expense-payer-error">{payerError}</FieldError>}
          </div>
        </div>
  );
  const peopleManagement = showPeople && !inTab ? (
    <div className="mt-3 border-t border-rule pt-2">
      <button
        type="button"
        onClick={() => setPeopleOpen((o) => !o)}
        aria-expanded={peopleOpen}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md py-3 text-sm font-medium text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
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
              <Button
                type="button"
                variant="link"
                size="touch"
                onClick={onAddPerson}
                className="mt-3 justify-start px-0 no-underline hover:text-ink hover:no-underline"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                Add person
              </Button>
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
            <Input autoFocus type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Nachos" className="mt-1" />
          </label>
          <label className="min-w-0 text-sm text-ink">Amount · {currencyCode}
            <Input type="number" inputMode="decimal" min={0} step={0.01} value={cost} onChange={e => setCost(e.target.value)} placeholder="0.00" className="font-numeric mt-1" />
          </label>
        </div>
        <div className="mt-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 py-3 text-sm text-ink">
            <input type="checkbox" checked={adjustmentsOpen} onChange={event => setAdjustmentsOpen(event.target.checked)} className="h-5 w-5 shrink-0 accent-forest" />
            Use individual discount, tax &amp; tip
          </label>
          <p className="mb-3 text-xs text-ink-soft">{adjustmentsOpen ? "Replaces all global adjustments for this item. Blank or zero means none." : "Uses the expense’s global discount, tax and tip."}</p>
          {adjustmentsOpen && <>
          <div className="rate-inputs-container"><div className="rate-inputs flex flex-wrap gap-4 [&>div]:flex-wrap">
            <RateInput wide label="Discount" icon={TicketPercent} rate={discount} onChange={setDiscount} />
            <RateInput wide label="Tax" icon={Percent} rate={tax} onChange={setTax} />
            <RateInput wide label="Tip" icon={Coins} rate={tip} onChange={setTip} />
          </div>
          </div>
          <p className="mt-2 text-xs text-ink-soft">Discount applies before tax and tip.</p>
          </>}
        </div>
      </div>
      <div className="min-w-0">
        <GroupTitle>Split this item</GroupTitle>
        <p className="mt-1 text-xs text-ink-soft">Equally among selected people</p>
        <div className="mt-3 space-y-2">
        {people.map(person => (
          <MemberSelectionRow
            key={person.id}
            id={person.id}
            name={person.name}
            selected={splitWith.includes(person.id)}
            onToggle={() => togglePerson(person.id)}
            anonymous={anonymousPersonIds.includes(person.id)}
          />
        ))}
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-margin-red-ink md:col-span-2">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2">
        <Button type="button" variant="outline" size="touch" onClick={closeItemEditor}>Cancel item changes</Button>
        <Button type="button" size="touch" onClick={handleSubmit}>
          {editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{editingId ? "Done with item" : "Add to expense"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="w-full">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1"><ExpenseTitle name={expenseName} onRename={onRenameExpense} />
          {tabField}
          {description && <PageDescription>{description}</PageDescription>}
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
            split={totals}
            onSave={(item) => (items[0] ? onUpdateItem(item) : onAddItem(item))}
            onRemove={onRemoveItem}
          />
        ) : (
          <>
            <section aria-label="Global adjustments" className="mb-4 border-b border-rule pb-4">
              <GroupTitle as="h2" className="mb-3">Global discount, tax &amp; tip</GroupTitle>
              <div className="rate-inputs-container"><div className="rate-inputs flex flex-wrap gap-4 [&>div]:flex-wrap">
                <RateInput wide label="Discount" icon={TicketPercent} rate={globalAdjustments.discount} onChange={discount => onSetGlobalAdjustments({ ...globalAdjustments, discount })} />
                <RateInput wide label="Tax" icon={Percent} rate={globalAdjustments.tax} onChange={tax => onSetGlobalAdjustments({ ...globalAdjustments, tax })} />
                <RateInput wide label="Tip" icon={Coins} rate={globalAdjustments.tip} onChange={tip => onSetGlobalAdjustments({ ...globalAdjustments, tip })} />
              </div>
              </div>
              <p className="mt-3 text-xs text-ink-soft">Applies to items without individual adjustments. Fixed amounts are shared proportionally. Discount applies before tax and tip.</p>
            </section>
            <div className="flex items-center justify-between gap-3">
              <GroupTitle as="h2">Items <span className="text-ink-soft">({items.length})</span></GroupTitle>
              <Button type="button" variant="outline" size="touch" onClick={() => { resetForm(); setAddingItem(true); }}><Plus className="h-4 w-4" />Add item</Button>
            </div>
            <Dialog open={addingItem || editingId !== null} onOpenChange={open => { if (!open) closeItemEditor(); }}>
              <DialogContent className="max-w-2xl">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <DialogTitle>{editingId ? "Edit item" : "New item"}</DialogTitle>
                  <DialogClose aria-label="Close item editor" render={<Button variant="ghost" size="icon-touch" className="text-ink-soft" />}>
                    <X className="h-4 w-4" />
                  </DialogClose>
                </div>
                <DialogDescription className="mb-5">Enter the item details and choose who shares it.</DialogDescription>
                {itemEditor}
              </DialogContent>
            </Dialog>

            {items.length > 0 && (
              <ul
                className="mt-2 space-y-3"
              >
                {items.map((item, i) => (
                  <ExpenseLineItem
                    key={item.id}
                    item={resolvedItems[i]}
                    hasOverrides={hasIndividualAdjustments(item)}
                    index={i}
                    people={people}
                    currency={currencyCode}
                    isEditing={item.id === editingId}
                    onEdit={() => startEdit(item)}
                    onRemove={() => handleRemove(item.id)}
                  />
                ))}
              </ul>
            )}
            {items.some(hasIndividualAdjustments) && (
              <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-soft">
                <Asterisk aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 text-brass" />
                <span>Uses individual discount, tax and tip instead of global adjustments. Blank or zero means none.</span>
              </p>
            )}
            <div className="mt-5 border-t border-rule pt-5">
              <section className="min-w-0">
                <GroupTitle as="h2">Total, including adjustments <span className="text-ink-soft">({currencyCode})</span></GroupTitle>
                <p className="font-numeric mt-2 break-words text-3xl text-ink">{currency(totals.grandTotal, currencyCode)}</p>
                <p className="mt-1 text-xs text-ink-soft">Calculated from {items.length} {items.length === 1 ? "item" : "items"}</p>
                {(totals.taxTotal > 0 || totals.tipTotal > 0) && <dl className="mt-4 space-y-2 border-t border-rule pt-3 text-sm text-ink-soft">
                  <div className="flex justify-between gap-3"><dt>{resolvedItems.some(item => item.discount.value > 0) ? "Subtotal after discounts" : "Subtotal"}</dt><dd className="font-numeric">{currency(totals.subtotal, currencyCode)}</dd></div>
                  {totals.taxTotal > 0 && <div className="flex justify-between gap-3"><dt>Tax</dt><dd className="font-numeric">{currency(totals.taxTotal, currencyCode)}</dd></div>}
                  {totals.tipTotal > 0 && <div className="flex justify-between gap-3"><dt>Tip</dt><dd className="font-numeric">{currency(totals.tipTotal, currencyCode)}</dd></div>}
                </dl>}
              </section>
              {peopleManagement}
            </div>
          </>
        )}

        <ExpenseBalances people={people} split={totals} payerId={payerId} currency={currencyCode} projected={isUpcoming(date)} unallocated={items.some((item) => item.splitWith.length === 0)} />

        <NoteField note={note} onSetNote={onSetNote} />
        <ExpenseImageField receipt={receipt} onPick={onPickReceipt} canUpload={canUploadImage} />
        {continueError && <p role="alert" className="mt-4 text-sm text-margin-red-ink">{continueError}</p>}

      <div className="mt-6 flex flex-col-reverse gap-2 border-t border-rule pt-5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        {onCancel ? <Button type="button" variant="outline" size="touch" onClick={onCancel}>{cancelLabel}</Button> : <span />}
        <Button
          type="button"
          size="touch"
          onClick={handleContinue}
          disabled={continueDisabled || items.length === 0 || !expenseName.trim() || continuing}
          aria-busy={continuing}
          className="w-full sm:w-auto"
        >
          {continueLabel}
          {continuing ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
          ) : (
            <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
          )}
        </Button>
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
    <div className="mt-4 rounded-md border border-rule transition has-[>button:hover]:border-forest">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest"
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
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                rows={3}
                placeholder="e.g. Dan covered the cab home, settle that separately."
                aria-label="Expense note"
              />
              {note && (
                <Button
                  type="button"
                  variant="destructive"
                  size="touch"
                  onClick={handleRemove}
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                  Delete note
                </Button>
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
      className={`inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${
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
  split,
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
  split: ReturnType<typeof computeSplit>;
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
      <Input
        id="expense-total"
        type="number"
        inputMode="decimal"
        min={0}
        step={0.01}
        value={cost}
        onChange={(e) => handleCostChange(e.target.value)}
        placeholder="0.00"
        aria-label="Expense total"
        className="font-numeric min-h-16 py-3 text-3xl sm:text-3xl"
      />
      </div>
      <div className="min-w-0 border-t border-rule pt-5 md:border-t-0 md:border-l md:pt-0 md:pl-6">
        <div className="mb-1 flex items-center justify-between gap-2">
          <GroupTitle as="h2">Split with</GroupTitle>
          <span className="text-sm text-ink-soft">Equally</span>
        </div>
        <p className="mb-2 text-xs text-ink-soft">{splitWith.length} {splitWith.length === 1 ? "person" : "people"} selected</p>
        <div className="space-y-2">
          {people.map((p) => (
            <MemberSelectionRow
              key={p.id}
              id={p.id}
              name={p.name}
              selected={splitWith.includes(p.id)}
              onToggle={() => toggleSplitWith(p.id)}
              anonymous={anonymousPersonIds.includes(p.id)}
              endContent={<span className="font-numeric shrink-0">{splitWith.includes(p.id) ? currency(split.people.find((row) => row.personId === p.id)?.total ?? 0, currencyCode) : "—"}</span>}
            />
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
        {/* An expense with no name yet never leaves edit mode, so without this
            the page would render no <h1> at all and open on an orphan <h2>. */}
        <PageTitle className="sr-only">{name || "New expense"}</PageTitle>
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          placeholder="Name this expense"
          aria-label="Expense name"
          required
          className="font-display max-w-md text-2xl! font-semibold"
        />
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <PageTitle className="min-w-0">{name}</PageTitle>
      <Button
        type="button"
        variant="ghost"
        size="icon-touch"
        onClick={() => {
          setValue(name);
          setEditing(true);
        }}
        aria-label="Rename expense"
        className="shrink-0 text-ink-soft hover:text-forest"
      >
        <Pencil className="h-4 w-4" strokeWidth={2.25} />
      </Button>
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
          <Input
            autoFocus
            aria-label={`Rename ${person.name}`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
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
        <Button
          type="button"
          variant="ghost"
          size="icon-touch"
          onClick={() => {
            setValue(person.name);
            setEditing(true);
          }}
          aria-label={`Rename ${person.name}`}
          className="shrink-0 text-ink-soft hover:text-forest"
        >
          <Pencil className="h-3.5 w-3.5" strokeWidth={2.25} />
        </Button>
      )}
      {removable && (
        <Button
          type="button"
          variant="ghost"
          size="icon-touch"
          onClick={onRemove}
          aria-label={`Remove ${person.name} from this expense`}
          className="shrink-0 text-ink-soft hover:text-margin-red-ink"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
        </Button>
      )}
    </li>
  );
}
