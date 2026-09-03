import type { ReceiptState, ReceiptItem, RateSetting } from "./types";

export type Action =
  | { type: "SET_TAX"; rate: RateSetting }
  | { type: "SET_TIP"; rate: RateSetting }
  | { type: "SET_DATE"; date: string }
  | { type: "ADD_ITEM"; item: ReceiptItem }
  | { type: "UPDATE_ITEM"; item: ReceiptItem }
  | { type: "REMOVE_ITEM"; id: string }
  | { type: "REORDER_ITEMS"; items: ReceiptItem[] }
  | { type: "SET_CONTRIBUTION"; personId: string; amount: RateSetting }
  | { type: "ADD_PERSON" }
  | { type: "RENAME_PERSON"; id: string; name: string }
  | { type: "RENAME_RECEIPT"; name: string | undefined }
  | { type: "GO_TO_RESULTS" }
  | { type: "BACK_TO_RECEIPT" };

export function receiptReducer(state: ReceiptState, action: Action): ReceiptState {
  switch (action.type) {
    case "SET_TAX":
      return { ...state, tax: action.rate };
    case "SET_TIP":
      return { ...state, tip: action.rate };
    case "SET_DATE":
      return { ...state, date: action.date };
    case "ADD_ITEM":
      return { ...state, items: [...state.items, action.item] };
    case "UPDATE_ITEM":
      return { ...state, items: state.items.map((i) => (i.id === action.item.id ? action.item : i)) };
    case "REMOVE_ITEM":
      return { ...state, items: state.items.filter((i) => i.id !== action.id) };
    case "REORDER_ITEMS":
      return { ...state, items: action.items };
    case "SET_CONTRIBUTION": {
      const exists = state.contributions.some((c) => c.personId === action.personId);
      const contributions = exists
        ? state.contributions.map((c) =>
            c.personId === action.personId ? { ...c, amount: action.amount } : c,
          )
        : [...state.contributions, { personId: action.personId, amount: action.amount }];
      return { ...state, contributions };
    }
    case "ADD_PERSON": {
      const n = state.people.length + 1;
      return { ...state, people: [...state.people, { id: `person-${n}`, name: `Person ${n}` }] };
    }
    case "RENAME_PERSON":
      return {
        ...state,
        people: state.people.map((p) => (p.id === action.id ? { ...p, name: action.name } : p)),
      };
    case "RENAME_RECEIPT":
      return { ...state, name: action.name };
    case "GO_TO_RESULTS":
      return { ...state, stage: "results" };
    case "BACK_TO_RECEIPT":
      return { ...state, stage: "receipt" };
    default:
      return state;
  }
}
