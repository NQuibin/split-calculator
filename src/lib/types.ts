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
  taxed: boolean;
  tipped: boolean;
  splitWith: string[];
}

export type Stage = "receipt" | "results";

export interface Contribution {
  personId: string;
  amount: RateSetting;
}

export interface ExpenseState {
  stage: Stage;
  /** Custom expense name; when unset, callers fall back to the people's names joined together. */
  name?: string;
  people: Person[];
  namePeople: boolean;
  items: ExpenseItem[];
  tax: RateSetting;
  tip: RateSetting;
  /** The date the expense was incurred, formatted YYYY-MM-DD. */
  date: string;
  /** What each person already paid toward the expense, so the split can show who's owed money back. */
  contributions: Contribution[];
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
