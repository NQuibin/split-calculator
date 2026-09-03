export type RateMode = "percent" | "amount";

export interface RateSetting {
  mode: RateMode;
  value: number;
}

export interface Person {
  id: string;
  name: string;
}

export interface ReceiptItem {
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

export interface ReceiptState {
  stage: Stage;
  /** Custom receipt name; when unset, callers fall back to the people's names joined together. */
  name?: string;
  people: Person[];
  namePeople: boolean;
  items: ReceiptItem[];
  tax: RateSetting;
  tip: RateSetting;
  /** The date the receipt was produced, formatted YYYY-MM-DD. */
  date: string;
  /** What each person already paid toward the receipt, so the split can show who's owed money back. */
  contributions: Contribution[];
  updatedAt?: number;
  /** Raw group id, present (when set) on `receipts.list` results - just enough to tell whether a receipt is already in a group. */
  groupId?: string;
  /** Resolved group name/slug, present (when set) on a single `receipts.get` result - for rendering a "part of {group}" link. */
  group?: { slug: string; name: string } | null;
  /** Ids of people linked to a still-anonymous group member, present on a single `receipts.get` result. */
  anonymousPersonIds?: string[];
}
