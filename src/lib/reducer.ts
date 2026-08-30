import type { ReceiptState, ReceiptItem, RateSetting } from "./types";

export type Action =
  | { type: "SET_TAX"; rate: RateSetting }
  | { type: "SET_TIP"; rate: RateSetting }
  | { type: "ADD_ITEM"; item: ReceiptItem }
  | { type: "UPDATE_ITEM"; item: ReceiptItem }
  | { type: "REMOVE_ITEM"; id: string }
  | { type: "REORDER_ITEMS"; items: ReceiptItem[] }
  | { type: "GO_TO_RESULTS" }
  | { type: "BACK_TO_RECEIPT" };

export function receiptReducer(state: ReceiptState, action: Action): ReceiptState {
  switch (action.type) {
    case "SET_TAX":
      return { ...state, tax: action.rate };
    case "SET_TIP":
      return { ...state, tip: action.rate };
    case "ADD_ITEM":
      return { ...state, items: [...state.items, action.item] };
    case "UPDATE_ITEM":
      return { ...state, items: state.items.map((i) => (i.id === action.item.id ? action.item : i)) };
    case "REMOVE_ITEM":
      return { ...state, items: state.items.filter((i) => i.id !== action.id) };
    case "REORDER_ITEMS":
      return { ...state, items: action.items };
    case "GO_TO_RESULTS":
      return { ...state, stage: "results" };
    case "BACK_TO_RECEIPT":
      return { ...state, stage: "receipt" };
    default:
      return state;
  }
}
