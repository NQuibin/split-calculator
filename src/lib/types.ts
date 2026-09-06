export type RateMode = "percent" | "amount";

export interface RateSetting {
  mode: RateMode;
  value: number;
}

export interface Person {
  id: string;
  name: string;
}

export interface ExpenseItem {
  id: string;
  name: string;
  cost: number;
  discount: RateSetting;
  tax: RateSetting;
  tip: RateSetting;
  splitWith: string[];
}

export type Stage = "receipt" | "results";

/** "simple" restricts an expense to one lump-sum item with no discount/tax/tip; "itemized" is the full line-item breakdown. */
export type ExpenseMode = "simple" | "itemized";

export interface Contribution {
  personId: string;
  amount: RateSetting;
}

/** A receipt photo (or PDF) attached to an expense, held in Convex file storage. */
export interface ExpenseImage {
  storageId: string;
  /** Original filename, used as the label on the open/download link. */
  name: string;
  type: string;
  /** Signed URL for viewing the file - minted per read, so it's only present on an `expenses.get` result. */
  url?: string | null;
}

export interface ExpenseState {
  stage: Stage;
  /** The expense's name - always set, initialized from the people's names joined together when first created. */
  name: string;
  people: Person[];
  namePeople: boolean;
  mode: ExpenseMode;
  items: ExpenseItem[];
  /** The date the expense was incurred, formatted YYYY-MM-DD. */
  date: string;
  /** What each person already paid toward the expense, so the split can show who's owed money back. */
  contributions: Contribution[];
  /** ISO 4217 code, e.g. "USD" - which currency the expense's amounts are in. */
  currency: string;
  /** Free-form note about the expense. Undefined when there's no note - a blank note is deleted rather than stored empty. */
  note?: string;
  /** Receipt image/PDF attached to the expense. Undefined once removed. Only ever set while signed in - uploads need an account. */
  image?: ExpenseImage;
  updatedAt?: number;
  /** Raw tab id, present (when set) on `expenses.list` results - just enough to tell whether an expense is already in a tab. */
  tabId?: string;
  /** Resolved tab name/slug, present (when set) on a single `expenses.get` result - for rendering a "part of {tab}" link. */
  tab?: { slug: string; name: string } | null;
  /** Ids of people linked to a still-anonymous tab member, present on a single `expenses.get` result. */
  anonymousPersonIds?: string[];
  /** Tab members not yet on this expense, present (when in a tab) on a single `expenses.get` result - the only people addable once an expense is in a tab. */
  availableTabMembers?: { id: string; name: string }[];
}
