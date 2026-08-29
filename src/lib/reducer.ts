import type { AppState, Person, ReceiptItem, RateSetting } from "./types";

export type Action =
  | { type: "CONFIRM_PEOPLE"; people: Person[]; namePeople: boolean }
  | { type: "SET_TAX"; rate: RateSetting }
  | { type: "SET_TIP"; rate: RateSetting }
  | { type: "ADD_ITEM"; item: ReceiptItem }
  | { type: "REMOVE_ITEM"; id: string }
  | { type: "GO_TO_RESULTS" }
  | { type: "BACK_TO_HEADCOUNT" }
  | { type: "BACK_TO_RECEIPT" }
  | { type: "RESET" };

export const initialState: AppState = {
  stage: "headcount",
  people: [],
  namePeople: false,
  items: [],
  tax: { mode: "percent", value: 0 },
  tip: { mode: "percent", value: 0 },
};

export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "CONFIRM_PEOPLE": {
      const nextIds = new Set(action.people.map((p) => p.id));
      const items = state.items.map((item) => {
        const kept = item.splitWith.filter((id) => nextIds.has(id));
        return { ...item, splitWith: kept.length > 0 ? kept : Array.from(nextIds) };
      });
      return {
        ...state,
        people: action.people,
        namePeople: action.namePeople,
        items,
        stage: "receipt",
      };
    }
    case "SET_TAX":
      return { ...state, tax: action.rate };
    case "SET_TIP":
      return { ...state, tip: action.rate };
    case "ADD_ITEM":
      return { ...state, items: [...state.items, action.item] };
    case "REMOVE_ITEM":
      return { ...state, items: state.items.filter((i) => i.id !== action.id) };
    case "GO_TO_RESULTS":
      return { ...state, stage: "results" };
    case "BACK_TO_HEADCOUNT":
      return { ...state, stage: "headcount" };
    case "BACK_TO_RECEIPT":
      return { ...state, stage: "receipt" };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}
