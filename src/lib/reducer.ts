import { computeSplit } from "./calculations";
import type { ExpenseState, ExpenseItem, ExpenseMode, Person, RateSetting } from "./types";

export type Action =
  | { type: "SET_MODE"; mode: ExpenseMode }
  | { type: "SET_DATE"; date: string }
  | { type: "ADD_ITEM"; item: ExpenseItem }
  | { type: "UPDATE_ITEM"; item: ExpenseItem }
  | { type: "REMOVE_ITEM"; id: string }
  | { type: "REORDER_ITEMS"; items: ExpenseItem[] }
  | { type: "SET_CONTRIBUTION"; personId: string; amount: RateSetting }
  | { type: "ADD_PERSON" }
  | { type: "RENAME_PERSON"; id: string; name: string }
  | { type: "RENAME_EXPENSE"; name: string | undefined }
  | { type: "GO_TO_RESULTS" }
  | { type: "BACK_TO_EXPENSE" };

const zeroRate: RateSetting = { mode: "percent", value: 0 };

// Simple mode allows only one lump-sum item with no discount/tax/tip, so
// switching into it from an itemized breakdown folds everything - cost,
// discount, tax, tip, across every item - into that single item's cost.
function collapseToSingleItem(people: Person[], items: ExpenseItem[]): ExpenseItem[] {
  if (items.length === 0) return items;
  const total = computeSplit(people, items).grandTotal;
  const splitWith = Array.from(new Set(items.flatMap((i) => i.splitWith)));
  return [
    {
      id: items[0].id,
      name: "Total",
      cost: total,
      discount: zeroRate,
      tax: zeroRate,
      tip: zeroRate,
      splitWith: splitWith.length > 0 ? splitWith : people.map((p) => p.id),
    },
  ];
}

export function expenseReducer(state: ExpenseState, action: Action): ExpenseState {
  switch (action.type) {
    case "SET_MODE": {
      if (action.mode === state.mode) return state;
      if (action.mode === "itemized") return { ...state, mode: "itemized" };
      return { ...state, mode: "simple", items: collapseToSingleItem(state.people, state.items) };
    }
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
    case "RENAME_EXPENSE":
      return { ...state, name: action.name };
    case "GO_TO_RESULTS":
      return { ...state, stage: "results" };
    case "BACK_TO_EXPENSE":
      return { ...state, stage: "receipt" };
    default:
      return state;
  }
}
