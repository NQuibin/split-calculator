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
