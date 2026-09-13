import { computeSplit } from "./calculations";
import type {
  ExpenseAdjustments,
  ExpenseImage,
  ExpenseState,
  ExpenseItem,
  ExpenseMode,
  Person,
  RateSetting,
} from "./types";

export type Action =
  | { type: "SET_GLOBAL_ADJUSTMENTS"; adjustments: ExpenseAdjustments }
  | { type: "SET_MODE"; mode: ExpenseMode }
  | { type: "SET_DATE"; date: string }
  | { type: "SET_CURRENCY"; currency: string }
  | { type: "SET_PAYER"; payerId: string | undefined }
  | { type: "SET_NOTE"; note: string }
  | { type: "SET_IMAGE"; image: ExpenseImage | null }
  | { type: "ADD_ITEM"; item: ExpenseItem }
  | { type: "UPDATE_ITEM"; item: ExpenseItem }
  | { type: "REMOVE_ITEM"; id: string }
  | { type: "REORDER_ITEMS"; items: ExpenseItem[] }
  | { type: "ADD_PERSON" }
  | { type: "REMOVE_PERSON"; id: string }
  | { type: "RENAME_PERSON"; id: string; name: string }
  | { type: "RENAME_EXPENSE"; name: string }
  | { type: "GO_TO_RESULTS" }
  | { type: "BACK_TO_EXPENSE" };

const zeroRate: RateSetting = { mode: "percent", value: 0 };

// Simple mode allows only one lump-sum item with no discount/tax/tip and no
// name of its own - it's always named after the expense - so switching into
// it from an itemized breakdown folds everything (cost, discount, tax, tip,
// across every item) into that single item's cost.
function collapseToSingleItem(
  name: string,
  people: Person[],
  items: ExpenseItem[],
  global?: ExpenseAdjustments,
): ExpenseItem[] {
  if (items.length === 0) return items;
  const total = computeSplit(people, items, global).grandTotal;
  const splitWith = Array.from(new Set(items.flatMap((i) => i.splitWith)));
  return [
    {
      id: items[0].id,
      name,
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
    case "SET_GLOBAL_ADJUSTMENTS":
      return { ...state, globalAdjustments: action.adjustments };
    case "SET_MODE": {
      if (action.mode === state.mode) return state;
      // Switching modes always clears whatever's mid-entry rather than
      // trying to carry it over - itemized items have their own name, one
      // total doesn't (it just takes the expense's), so there's nothing
      // meaningful to transfer between the two shapes.
      if (action.mode === "itemized") return { ...state, mode: "itemized", items: [] };
      return {
        ...state,
        mode: "simple",
        globalAdjustments: undefined,
        items: collapseToSingleItem(state.name, state.people, state.items, state.globalAdjustments),
      };
    }
    case "SET_DATE":
      return { ...state, date: action.date };
    case "SET_CURRENCY":
      return { ...state, currency: action.currency };
    case "SET_PAYER":
      return {
        ...state,
        payerId: state.people.some((person) => person.id === action.payerId)
          ? action.payerId
          : undefined,
      };
    case "SET_NOTE": {
      // A blank note is no note at all - drop the field entirely so adding,
      // updating and deleting a note are all this one action.
      const note = action.note.trim();
      return { ...state, note: note || undefined };
    }
    case "SET_IMAGE":
      // Removing an image drops the field; the save mutation deletes the
      // now-unreferenced file from storage.
      return { ...state, image: action.image ?? undefined };
    case "ADD_ITEM":
      return { ...state, items: [...state.items, action.item] };
    case "UPDATE_ITEM":
      return {
        ...state,
        items: state.items.map((i) => (i.id === action.item.id ? action.item : i)),
      };
    case "REMOVE_ITEM":
      return { ...state, items: state.items.filter((i) => i.id !== action.id) };
    case "REORDER_ITEMS":
      return { ...state, items: action.items };
    case "ADD_PERSON": {
      let n = state.people.length + 1;
      while (state.people.some((person) => person.id === `person-${n}`)) n += 1;
      return { ...state, people: [...state.people, { id: `person-${n}`, name: `Person ${n}` }] };
    }
    case "REMOVE_PERSON": {
      if (state.people.length <= 1 || !state.people.some((person) => person.id === action.id))
        return state;
      const people = state.people.filter((person) => person.id !== action.id);
      const remainingIds = people.map((person) => person.id);
      return {
        ...state,
        people,
        payerId: state.payerId === action.id ? undefined : state.payerId,
        items: state.items.map((item) => {
          const splitWith = item.splitWith.filter((id) => id !== action.id);
          return { ...item, splitWith: splitWith.length > 0 ? splitWith : remainingIds };
        }),
      };
    }
    case "RENAME_PERSON":
      return {
        ...state,
        people: state.people.map((p) => (p.id === action.id ? { ...p, name: action.name } : p)),
      };
    case "RENAME_EXPENSE": {
      // In "one total" mode the single item is always named after the
      // expense, so keep it in sync when the expense itself is renamed.
      if (state.mode === "simple" && state.items[0]) {
        return { ...state, name: action.name, items: [{ ...state.items[0], name: action.name }] };
      }
      return { ...state, name: action.name };
    }
    case "GO_TO_RESULTS":
      return { ...state, stage: "results" };
    case "BACK_TO_EXPENSE":
      return { ...state, stage: "receipt" };
    default:
      return state;
  }
}
