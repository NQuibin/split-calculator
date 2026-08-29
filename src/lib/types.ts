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
  discount: number;
  taxed: boolean;
  tipped: boolean;
  splitWith: string[];
}

export type Stage = "headcount" | "receipt" | "results";

export interface AppState {
  stage: Stage;
  people: Person[];
  namePeople: boolean;
  items: ReceiptItem[];
  tax: RateSetting;
  tip: RateSetting;
}
