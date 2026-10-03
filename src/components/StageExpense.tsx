import { type ReactNode, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Asterisk,
  Banknote,
  DollarSign,
  CalendarDays,
  Calculator,
  Check,
  ChevronDown,
  Coins,
  ListChecks,
  Loader2,
  Pencil,
  Settings,
  Percent,
  Plus,
  StickyNote,
  TicketPercent,
  X,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label, Textarea } from "@/components/ui/Input";
import { CurrencyPicker } from "@/components/ui/CurrencyPicker";
import { DatePicker } from "@/components/ui/DatePicker";
import { DropdownChevron } from "@/components/ui/DropdownChevron";
import { RateInput } from "@/components/ui/RateInput";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/Dialog";
import { ExpenseLineItem } from "@/components/ui/ExpenseLineItem";
import { MenuOption } from "@/components/ui/MenuOption";
import { Panel } from "@/components/ui/Page";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { ExpenseImageField, type ReceiptSummary } from "@/components/ExpenseImageField";
import { computeSplit, hasIndividualAdjustments, resolveItemAdjustments } from "@/lib/calculations";
import { isUpcoming } from "@/lib/format";
import { useLocaleFormatters } from "@/lib/localeFormatters";
import type {
  ExpenseAdjustments,
  Person,
  RateSetting,
  ExpenseItem,
  ExpenseMode,
} from "@/lib/types";
import { GroupTitle, PageDescription, PageTitle } from "@/components/ui/Typography";
import { MemberSelectionRow } from "@/components/ui/MemberSelectionRow";
import { MemberAvatar } from "@/components/MemberAvatar";
import { TipRateInput } from "@/components/ui/TipRateInput";
import { Switch } from "@/components/ui/Switch";

const zeroAdjustments: ExpenseAdjustments = {
  discount: { mode: "amount", value: 0 },
  tax: { mode: "percent", value: 0 },
  tip: { mode: "percent", value: 0 },
};

const zeroRate: RateSetting = { mode: "percent", value: 0 };

const collapseTransition = { duration: 0.2, ease: "easeInOut" as const };

interface StageExpenseProps {
  expenseName: string;
  description?: string;
  tabField?: ReactNode;
  continueDisabled?: boolean;
  showPeople?: boolean;
  onCancel?: () => void;
  cancelLabel?: string;
  onRenameExpense: (name: string) => void;
  savedExpense?: boolean;
  onOpenSettings?: () => void;
  people: Person[];
  /** The signed-in user's own id, if any - their person row is tied to their real account name, so it's locked from renaming here just like a claimed tab member. */
  viewerId?: string;
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
  tabField,
  continueDisabled = false,
  showPeople = true,
  onCancel,
  cancelLabel = "Cancel",
  onRenameExpense,
  savedExpense = false,
  onOpenSettings,
  people,
  viewerId,
  inTab = false,
  mode,
  items,
  globalAdjustments: globalAdjustmentsProp,
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
  const { currency } = useLocaleFormatters();
  const allIds = useMemo(() => people.map((p) => p.id), [people]);

  // Canadian bills tip on the taxed subtotal, so a CAD expense starts with
  // that order picked. Only a brand new expense takes it - one already
  // carrying adjustments keeps whatever order it was saved with.
  const tipAfterTaxDefault = currencyCode === "CAD";
  const globalAdjustments = useMemo(
    () =>
      globalAdjustmentsProp ??
      (tipAfterTaxDefault ? { ...zeroAdjustments, tipAfterTax: true } : zeroAdjustments),
    [globalAdjustmentsProp, tipAfterTaxDefault],
  );

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
  const [tipAfterTax, setTipAfterTax] = useState(tipAfterTaxDefault);
  const [splitWith, setSplitWith] = useState<string[]>(allIds);
  const [splitType, setSplitType] = useState<"equal" | "percentage" | "amount">("equal");
  const [splitValues, setSplitValues] = useState<{ memberId: string; value: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [continuing, setContinuing] = useState(false);
  const [continueError, setContinueError] = useState<string | null>(null);
  const [payerError, setPayerError] = useState<string | null>(null);

  const resolvedItems = useMemo(
    () => resolveItemAdjustments(items, globalAdjustments),
    [items, globalAdjustments],
  );
  const totals = useMemo(
    () => computeSplit(people, items, globalAdjustments),
    [people, items, globalAdjustments],
  );

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
    if (items.some((item) => !isSplitValid(item))) {
      setContinueError(
        "Each percentage split must total 100%, and each amount split must equal its item cost.",
      );
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
    setTipAfterTax(tipAfterTaxDefault);
    setSplitWith(allIds);
    setSplitType("equal");
    setSplitValues([]);
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
    setTipAfterTax(item.tipAfterTax ?? tipAfterTaxDefault);
    setSplitWith(
      item.splitType && item.splitType !== "equal"
        ? (item.splitValues ?? []).filter((entry) => entry.value > 0).map((entry) => entry.memberId)
        : item.splitWith,
    );
    setSplitType(item.splitType ?? "equal");
    setSplitValues(item.splitValues ?? []);
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
    const assigned = splitValues.filter((entry) => splitWith.includes(entry.memberId));
    if (
      splitType !== "equal" &&
      (assigned.length !== splitWith.length ||
        Math.round(assigned.reduce((sum, entry) => sum + entry.value, 0) * 100) !==
          Math.round((splitType === "percentage" ? 100 : parsedCost) * 100))
    ) {
      setError(
        splitType === "percentage"
          ? "Percentages must total 100%."
          : "Amounts must equal the item cost.",
      );
      return;
    }
    const item: ExpenseItem = {
      id: editingId ?? crypto.randomUUID(),
      name: name.trim(),
      cost: parsedCost,
      discount,
      tax,
      tip,
      tipAfterTax,
      splitWith,
      splitType,
      splitValues: splitValues.filter((entry) => splitWith.includes(entry.memberId)),
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
    <div className="grid min-w-0 gap-4 md:grid-cols-2">
      <div className="min-w-0">
        <Label htmlFor="expense-date" icon={CalendarDays}>
          Date
        </Label>
        <DatePicker
          id="expense-date"
          value={date ?? ""}
          onChange={onSetDate}
          aria-label="Expense date"
          className="w-full"
        />
      </div>
      <div className="min-w-0">
        <Label htmlFor="expense-currency" icon={Banknote}>
          Currency
        </Label>
        <CurrencyPicker
          id="expense-currency"
          value={currencyCode}
          onChange={onSetCurrency}
          aria-label="Expense currency"
          className="w-full"
        />
      </div>
      <div className="min-w-0 md:col-span-2">
        <Label id="expense-payer-label" htmlFor="expense-payer" icon={User}>
          {isUpcoming(date) ? "Will be paid by" : "Paid by"}
        </Label>
        <Popover open={payerOpen} onOpenChange={setPayerOpen}>
          <PopoverTrigger
            render={
              <Button
                id="expense-payer"
                variant="field"
                aria-labelledby="expense-payer-label expense-payer-value"
                aria-required="true"
                aria-invalid={payerError ? "true" : undefined}
                aria-describedby={payerError ? "expense-payer-error" : undefined}
                className="group min-h-11 w-full justify-between rounded-md px-3 py-2 text-base sm:text-sm"
              />
            }
          >
            <span id="expense-payer-value" className="min-w-0 flex-1 truncate text-left">
              {people.find((person) => person.id === payerId)?.name ?? "Select a payer"}
            </span>
            <DropdownChevron />
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
        {payerError && <FieldError id="expense-payer-error">{payerError}</FieldError>}
      </div>
    </div>
  );
  const peopleManagement =
    showPeople && !inTab ? (
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
                  className="mt-3 justify-start px-0 no-underline hover:text-ink hover:no-underline active:text-ink active:no-underline"
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

  const draftItemSplitItem: ExpenseItem = {
    id: editingId ?? "item-preview",
    name: name.trim(),
    cost: Number(cost) || 0,
    discount: adjustmentsOpen ? discount : zeroRate,
    tax: adjustmentsOpen ? tax : zeroRate,
    tip: adjustmentsOpen ? tip : zeroRate,
    tipAfterTax: adjustmentsOpen && tipAfterTax,
    splitWith,
    splitType,
    splitValues,
    overrideAdjustments: adjustmentsOpen,
  };
  const draftItems = editingId
    ? items.map((item) => (item.id === editingId ? draftItemSplitItem : item))
    : [...items, draftItemSplitItem];
  const draftItemSplit = computeSplit(people, draftItems, globalAdjustments);
  const draftItemShares = new Map(
    draftItemSplit.people.map((person) => {
      const line = person.lines.find((entry) => entry.itemId === draftItemSplitItem.id);
      return [person.personId, line ? line.share + line.taxShare + line.tipShare : 0];
    }),
  );

  const itemEditor = (
    <div className="grid gap-4">
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Label className="mb-0 min-w-0">
          Item name
          <Input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Nachos"
            className="mt-2"
          />
        </Label>
        <Label icon={DollarSign} className="mb-0 min-w-0">
          Amount · {currencyCode}
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.01}
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="0.00"
            className="font-numeric"
            wrapperClassName="mt-2"
          />
        </Label>
      </div>

      <section className="border-y border-rule py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ink">Use individual discount, tax &amp; tip</p>
            <p className="text-xs text-ink-soft">Override global adjustments for this item.</p>
          </div>
          <Switch
            checked={adjustmentsOpen}
            onCheckedChange={setAdjustmentsOpen}
            aria-label="Use individual discount, tax and tip"
          />
        </div>
        <AnimatePresence initial={false}>
          {adjustmentsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={collapseTransition}
              className="overflow-hidden"
            >
              <div className="mt-4 grid items-start gap-4 border-t border-rule pt-4 sm:grid-cols-3">
                <RateInput
                  label="Discount"
                  icon={TicketPercent}
                  rate={discount}
                  onChange={setDiscount}
                  fullWidth
                />
                <RateInput label="Tax" icon={Percent} rate={tax} onChange={setTax} fullWidth />
                <RateInput
                  label="Tip"
                  icon={Coins}
                  rate={tip}
                  onChange={setTip}
                  fullWidth
                  footer={
                    tip.mode === "percent" ? (
                      <div className="mt-3 flex min-h-11 items-center justify-between gap-2">
                        <span className="text-sm text-ink">Apply tip after tax</span>
                        <Switch
                          checked={tipAfterTax}
                          onCheckedChange={setTipAfterTax}
                          aria-label="Apply tip after tax"
                        />
                      </div>
                    ) : undefined
                  }
                />
                <p className="text-xs text-ink-soft sm:col-span-3">
                  Discount applies before tax and tip.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <section>
        <div className="mb-3">
          <GroupTitle>Split this item</GroupTitle>
        </div>
        <SplitEditor
          hideTypeLabel
          people={people}
          splitWith={splitWith}
          splitType={splitType}
          splitValues={splitValues}
          total={Number(cost) || 0}
          currencyCode={currencyCode}
          shares={draftItemShares}
          onSelectionChange={setSplitWith}
          onTypeChange={(type, values) => {
            setSplitType(type);
            setSplitValues(values);
            if (type !== "equal") {
              setSplitWith(
                values.filter((entry) => entry.value > 0).map((entry) => entry.memberId),
              );
            }
          }}
          onValuesChange={(values) => {
            setSplitValues(values);
            setSplitWith(values.filter((entry) => entry.value > 0).map((entry) => entry.memberId));
          }}
        />
      </section>
      {error && (
        <p role="alert" className="text-sm text-margin-red-ink">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="secondary"
          size="touch"
          className="w-full sm:w-auto"
          onClick={closeItemEditor}
        >
          Cancel
        </Button>
        <Button type="button" size="touch" className="w-full sm:w-auto" onClick={handleSubmit}>
          {editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {editingId ? "Update" : "Add"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="w-full">
      <header className="mb-6">
        <div className="min-w-0">
          <div className="flex w-full min-w-0 items-center gap-2">
            <ExpenseTitle name={expenseName} onRename={onRenameExpense} saved={savedExpense} />
            {savedExpense && (
              <Button
                type="button"
                variant="menu-icon"
                size="icon-touch"
                aria-label="Expense settings"
                onClick={onOpenSettings}
                className="ml-auto shrink-0"
              >
                <Settings aria-hidden="true" className="h-5 w-5" />
              </Button>
            )}
          </div>
          {tabField}
          {description && <PageDescription>{description}</PageDescription>}
        </div>
      </header>

      <Panel bleedOnMobile className="card-inset">
        <div className="mb-4 flex gap-4 border-b border-rule pb-4">
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
            key={people.map((person) => person.id).join(",")}
            expenseName={expenseName}
            peopleManagement={peopleManagement}
            currencyCode={currencyCode}
            people={people}
            item={items[0]}
            split={totals}
            onSave={(item) => (items[0] ? onUpdateItem(item) : onAddItem(item))}
            onRemove={onRemoveItem}
          />
        ) : (
          <>
            <section aria-label="Global adjustments" className="mb-4 border-b border-rule pb-4">
              <GroupTitle as="h2" className="mb-3">
                Discount, Tax &amp; Tip
              </GroupTitle>
              <div className="rate-inputs-container">
                <div className="rate-inputs rate-inputs-global">
                  <RateInput
                    label="Discount"
                    icon={TicketPercent}
                    rate={globalAdjustments.discount}
                    onChange={(discount) =>
                      onSetGlobalAdjustments({ ...globalAdjustments, discount })
                    }
                    fullWidth
                  />
                  <div className="rate-inputs-tax-tip">
                    <RateInput
                      label="Tax"
                      icon={Percent}
                      rate={globalAdjustments.tax}
                      onChange={(tax) => onSetGlobalAdjustments({ ...globalAdjustments, tax })}
                      fullWidth
                    />
                    <TipRateInput
                      rate={globalAdjustments.tip}
                      onChange={(tip) => onSetGlobalAdjustments({ ...globalAdjustments, tip })}
                      afterTax={globalAdjustments.tipAfterTax ?? false}
                      onAfterTaxChange={(tipAfterTax) =>
                        onSetGlobalAdjustments({ ...globalAdjustments, tipAfterTax })
                      }
                      fullWidth
                    />
                  </div>
                </div>
              </div>
            </section>
            <div className="flex items-center justify-between gap-3">
              <GroupTitle as="h2">
                Items <span className="text-ink-soft">({items.length})</span>
              </GroupTitle>
              <Button
                type="button"
                variant="secondary"
                size="touch"
                onClick={() => {
                  resetForm();
                  setAddingItem(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Add item
              </Button>
            </div>
            <Dialog
              open={addingItem || editingId !== null}
              onOpenChange={(open) => {
                if (!open) closeItemEditor();
              }}
            >
              <DialogContent className="max-w-4xl">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <DialogTitle>{editingId ? "Edit item" : "New item"}</DialogTitle>
                  <DialogClose
                    aria-label="Close item editor"
                    render={<Button variant="ghost" size="icon-touch" className="text-ink-soft" />}
                  >
                    <X className="h-4 w-4" />
                  </DialogClose>
                </div>
                {itemEditor}
              </DialogContent>
            </Dialog>

            {items.length > 0 && (
              <ul className="bleed mt-5 divide-y divide-rule overflow-hidden border-y border-edge bg-field">
                {items.map((item, i) => (
                  <ExpenseLineItem
                    key={item.id}
                    item={resolvedItems[i]}
                    hasOverrides={hasIndividualAdjustments(item)}
                    discountRate={
                      hasIndividualAdjustments(item) ? item.discount : globalAdjustments.discount
                    }
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
                <span>
                  Uses individual discount, tax and tip instead of global adjustments. Blank or zero
                  means none.
                </span>
              </p>
            )}
            <div className="mt-5 border-t border-rule pt-5">
              <section className="min-w-0">
                <dl className="space-y-2 text-sm text-ink-soft">
                  <div className="flex justify-between gap-3">
                    <dt>
                      {resolvedItems.some((item) => item.discount.value > 0)
                        ? "Subtotal after discounts"
                        : "Subtotal"}
                    </dt>
                    <dd className="font-numeric">{currency(totals.subtotal, currencyCode)}</dd>
                  </div>
                  {totals.taxTotal > 0 && (
                    <div className="flex justify-between gap-3">
                      <dt>Tax</dt>
                      <dd className="font-numeric">{currency(totals.taxTotal, currencyCode)}</dd>
                    </div>
                  )}
                  {totals.tipTotal > 0 && (
                    <div className="flex justify-between gap-3">
                      <dt>Tip</dt>
                      <dd className="font-numeric">{currency(totals.tipTotal, currencyCode)}</dd>
                    </div>
                  )}
                </dl>
                <div className="mt-4 border-t border-rule pt-4">
                  <GroupTitle as="h2">
                    Total, including adjustments{" "}
                    <span className="text-ink-soft">({currencyCode})</span>
                  </GroupTitle>
                  <p className="font-numeric mt-2 break-words text-3xl text-ink">
                    {currency(totals.grandTotal, currencyCode)}
                  </p>
                </div>
              </section>
              {peopleManagement}
            </div>
          </>
        )}

        <NoteField note={note} onSetNote={onSetNote} />
        <ExpenseImageField receipt={receipt} onPick={onPickReceipt} canUpload={canUploadImage} />
        {continueError && (
          <p role="alert" className="mt-4 text-sm text-margin-red-ink">
            {continueError}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-rule pt-5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          {onCancel ? (
            <Button type="button" variant="secondary" size="touch" onClick={onCancel}>
              {cancelLabel}
            </Button>
          ) : (
            <span />
          )}
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
      </Panel>
    </div>
  );
}

function NoteField({ note, onSetNote }: { note?: string; onSetNote: (note: string) => void }) {
  const [open, setOpen] = useState(() => !!note);

  return (
    <section aria-label="Note" className="mt-5 border-t border-rule pt-5">
      <div className="flex items-center justify-between gap-3">
        <Label
          htmlFor="expense-note"
          icon={StickyNote}
          subtext="Optional — anything worth remembering about this expense."
          className="mb-0"
        >
          Note
        </Label>
        <Switch checked={open} onCheckedChange={setOpen} aria-label="Note" />
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={collapseTransition}
            className="overflow-hidden"
          >
            <Textarea
              id="expense-note"
              value={note ?? ""}
              onChange={(e) => onSetNote(e.target.value)}
              rows={3}
              placeholder="e.g. Dan covered the cab home, settle that separately."
              className="mt-3"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
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
          : "border-rule text-ink-soft hover:border-forest hover:text-forest active:border-forest active:text-forest"
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
  item?: ExpenseItem;
  split: ReturnType<typeof computeSplit>;
  onSave: (item: ExpenseItem) => void;
  onRemove: (id: string) => void;
}) {
  // A one-total item has no name of its own - it's always named after the
  // expense - so this form only needs to capture the amount.
  const [cost, setCost] = useState(item ? String(item.cost) : "");
  const [splitWith, setSplitWith] = useState<string[]>(
    item?.splitType && item.splitType !== "equal"
      ? (item.splitValues ?? []).filter((entry) => entry.value > 0).map((entry) => entry.memberId)
      : (item?.splitWith ?? people.map((p) => p.id)),
  );
  const [splitType, setSplitType] = useState<"equal" | "percentage" | "amount">(
    item?.splitType ?? "equal",
  );
  const [splitValues, setSplitValues] = useState(item?.splitValues ?? []);

  function commit(
    nextCost: string,
    nextSplitWith: string[],
    nextType = splitType,
    nextValues = splitValues,
  ) {
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
      splitType: nextType,
      splitValues: nextValues.filter((entry) => nextSplitWith.includes(entry.memberId)),
    });
  }

  function handleCostChange(value: string) {
    setCost(value);
    commit(value, splitWith);
  }

  function changeType(type: "equal" | "percentage" | "amount", values: SplitValue[]) {
    const nextSplitWith =
      type === "equal"
        ? splitWith
        : values.filter((entry) => entry.value > 0).map((entry) => entry.memberId);
    setSplitType(type);
    setSplitValues(values);
    setSplitWith(nextSplitWith);
    commit(cost, nextSplitWith, type, values);
  }

  function changeValues(values: SplitValue[]) {
    const nextSplitWith = values.filter((entry) => entry.value > 0).map((entry) => entry.memberId);
    setSplitWith(nextSplitWith);
    setSplitValues(values);
    commit(cost, nextSplitWith, splitType, values);
  }

  return (
    <div className="grid gap-5">
      <div className="min-w-0">
        <Label htmlFor="expense-total" icon={DollarSign}>
          Total amount <span className="text-ink-soft">({currencyCode})</span>
        </Label>
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
      <div className="min-w-0 border-t border-rule pt-5">
        <GroupTitle as="h2" className="mb-3">
          Split with
        </GroupTitle>
        <SplitEditor
          hideTypeLabelOnDesktop
          people={people}
          splitWith={splitWith}
          splitType={splitType}
          splitValues={splitValues}
          total={Number(cost) || 0}
          currencyCode={currencyCode}
          shares={new Map(split.people.map((row) => [row.personId, row.total]))}
          onSelectionChange={(next) => {
            setSplitWith(next);
            commit(cost, next);
          }}
          onTypeChange={changeType}
          onValuesChange={changeValues}
        />
        {peopleManagement}
      </div>
    </div>
  );
}

type SplitType = "equal" | "percentage" | "amount";
type SplitValue = { memberId: string; value: number };

function isSplitValid(item: ExpenseItem) {
  const type = item.splitType ?? "equal";
  if (type === "equal") return true;
  const values = item.splitValues ?? [];
  return (
    values.length === item.splitWith.length &&
    values.every(
      (entry) =>
        item.splitWith.includes(entry.memberId) && Number.isFinite(entry.value) && entry.value >= 0,
    ) &&
    Math.round(values.reduce((sum, entry) => sum + entry.value, 0) * 100) ===
      Math.round((type === "percentage" ? 100 : item.cost) * 100)
  );
}

function SplitEditor({
  hideTypeLabel = false,
  hideTypeLabelOnDesktop = false,
  people,
  splitWith,
  splitType,
  splitValues,
  total,
  currencyCode,
  shares,
  onSelectionChange,
  onTypeChange,
  onValuesChange,
}: {
  hideTypeLabel?: boolean;
  hideTypeLabelOnDesktop?: boolean;
  people: Person[];
  splitWith: string[];
  splitType: SplitType;
  splitValues: SplitValue[];
  total: number;
  currencyCode: string;
  shares: Map<string, number>;
  onSelectionChange: (ids: string[]) => void;
  onTypeChange: (type: SplitType, values: SplitValue[]) => void;
  onValuesChange: (values: SplitValue[]) => void;
}) {
  const { currency } = useLocaleFormatters();
  const valueFor = (id: string) => splitValues.find((entry) => entry.memberId === id)?.value ?? 0;
  const selected = people.filter((person) => splitWith.includes(person.id));
  const sum = selected.reduce((acc, person) => acc + valueFor(person.id), 0);

  function updateValue(id: string, value: number) {
    onValuesChange([
      ...splitValues.filter((entry) => entry.memberId !== id),
      { memberId: id, value },
    ]);
  }

  function toggle(id: string, checked: boolean) {
    const next = checked ? [...splitWith, id] : splitWith.filter((personId) => personId !== id);
    if (next.length > 0) onSelectionChange(next);
  }

  function selectType(type: SplitType) {
    if (type === splitType) {
      onTypeChange(type, splitValues);
      return;
    }
    const target = type === "percentage" ? 100 : total;
    const weights = selected.map((person) => (splitType === "equal" ? 1 : valueFor(person.id)));
    const weightTotal = weights.reduce((sum, value) => sum + value, 0);
    let allocated = 0;
    const values =
      type === "equal"
        ? splitValues
        : selected.map((person, index) => {
            const value =
              index === selected.length - 1
                ? Math.round((target - allocated) * 100) / 100
                : Math.round(((target * weights[index]) / (weightTotal || selected.length)) * 100) /
                  100;
            allocated += value;
            return { memberId: person.id, value };
          });
    onTypeChange(type, values);
  }

  return (
    <div className="grid gap-3">
      <div>
        {!hideTypeLabel && (
          <span
            className={`mb-2 block text-sm font-medium text-ink ${hideTypeLabelOnDesktop ? "md:sr-only" : ""}`}
          >
            Split type
          </span>
        )}
        <fieldset className="grid grid-cols-3 gap-2">
          <legend className="sr-only">Split type</legend>
          {(["equal", "percentage", "amount"] as const).map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={splitType === type}
              onClick={() => selectType(type)}
              className={`min-h-11 rounded-lg border px-2 text-sm font-medium capitalize focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${
                splitType === type
                  ? "border-forest bg-forest text-surface"
                  : "border-edge bg-field text-ink hover:bg-wash active:bg-wash"
              }`}
            >
              {type === "equal" ? "Equally" : type === "percentage" ? "Percent" : "Amount"}
            </button>
          ))}
        </fieldset>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-ink-soft">
        <span>
          {splitType === "equal"
            ? "Selected people pay equal shares."
            : splitType === "percentage"
              ? "Set each person's percentage."
              : "Set each person's amount."}
        </span>
        <span>
          {splitType === "equal"
            ? "Amount each"
            : splitType === "percentage"
              ? `Remaining: ${Math.max(0, Math.round((100 - sum) * 100) / 100)}%`
              : `Remaining: ${currency(Math.max(0, total - sum), currencyCode)}`}
        </span>
      </div>
      <div className="space-y-2">
        {people.map((person) => {
          const isSelected = splitWith.includes(person.id);
          const share = shares.get(person.id) ?? 0;
          return splitType === "equal" ? (
            <MemberSelectionRow
              key={person.id}
              id={person.id}
              name={person.name}
              selected={isSelected}
              onToggle={() => toggle(person.id, !isSelected)}
              endContent={
                <span className="shrink-0 font-numeric">
                  {isSelected ? currency(share, currencyCode) : "—"}
                </span>
              }
            />
          ) : (
            <div
              key={person.id}
              className={`flex min-h-[50px] items-center gap-2 overflow-hidden rounded-md border border-edge pl-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-forest ${valueFor(person.id) > 0 ? "bg-field" : "bg-surface"}`}
            >
              <span className="flex min-w-0 flex-1 items-center gap-3">
                <MemberAvatar id={person.id} name={person.name} />
                <span className="min-w-0 break-words text-sm text-ink">{person.name}</span>
              </span>
              {splitType === "percentage" && (
                <span className="w-20 shrink-0 text-right font-numeric text-sm text-ink-soft">
                  {currency((total * valueFor(person.id)) / 100, currencyCode)}
                </span>
              )}
              <Input
                aria-label={`${person.name} ${splitType === "percentage" ? "percentage" : "amount"}`}
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={valueFor(person.id) || ""}
                onChange={(event) => updateValue(person.id, Number(event.target.value) || 0)}
                className="w-24 shrink-0 self-stretch rounded-none border-y-0 border-r-0 bg-field px-2 text-right font-numeric"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExpenseTitle({
  name,
  onRename,
  saved,
}: {
  name: string;
  onRename: (name: string) => void;
  saved: boolean;
}) {
  // A brand-new expense has no name yet - there's nothing valid to show in
  // display mode, so it starts straight in the editing form.
  if (!saved) {
    return (
      <div className="min-w-0 flex-1">
        {/* An expense with no name yet never leaves edit mode, so without this
            the page would render no <h1> at all and open on an orphan <h2>. */}
        <PageTitle className="sr-only">{name || "New expense"}</PageTitle>
        <Label htmlFor="expense-name">Expense name</Label>
        <Input
          id="expense-name"
          value={name}
          onChange={(e) => onRename(e.target.value)}
          placeholder="Name this expense"
          aria-label="Expense name"
          required
          className="font-display max-w-md font-medium"
        />
      </div>
    );
  }
  return <PageTitle className="min-w-0">{name}</PageTitle>;
}

function PersonRow({
  person,
  locked = false,
  removable = false,
  onRemove,
  onRename,
}: {
  person: Person;
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
          <Label icon={User}>
            Person name
            <Input
              wrapperClassName="mt-2"
              autoFocus
              aria-label={`Rename ${person.name}`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={commit}
            />
          </Label>
        </form>
      </li>
    );
  }

  return (
    <li className="flex max-w-full items-center justify-between gap-2 rounded-full border border-rule bg-paper px-4 py-2">
      <span className="truncate text-ink">{person.name}</span>
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
          className="shrink-0 text-ink-soft hover:text-forest active:text-forest"
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
          className="shrink-0 text-ink-soft hover:text-margin-red-ink active:text-margin-red-ink"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
        </Button>
      )}
    </li>
  );
}
