import { DEFAULT_CURRENCY } from "./currencies";
import { todayISODate } from "./format";
import type { Person, ExpenseState } from "./types";

// A brand-new expense isn't persisted until its first item is added (see
// storage.ts), so its starting people/namePeople travel in the URL instead.
// Person.id is always `person-${index + 1}` (see reducer.ts's ADD_PERSON),
// except the first person when starting from a signed-in account - they keep
// their real user id (carried via `uid`) so they stay linked to their
// account - so only the count, names, and that one id need to be encoded,
// not full Person objects, to keep the query string short.

export function encodeDraftParams(people: Person[], namePeople: boolean, currentUserId?: string): URLSearchParams {
  const params = new URLSearchParams({ count: String(people.length) });
  if (namePeople) {
    params.set("names", people.map((p) => encodeURIComponent(p.name)).join(","));
  }
  if (currentUserId) {
    params.set("uid", currentUserId);
  }
  return params;
}

export function draftFromParams(params: URLSearchParams): ExpenseState | null {
  const count = Number(params.get("count"));
  if (!Number.isInteger(count) || count <= 0) return null;

  const namesParam = params.get("names");
  const namePeople = namesParam !== null;
  const names = namePeople ? namesParam.split(",").map((n) => decodeURIComponent(n)) : [];
  const uid = params.get("uid");

  const people: Person[] = Array.from({ length: count }, (_, i) => ({
    id: i === 0 && uid ? uid : `person-${i + 1}`,
    name: namePeople ? (names[i] ?? `Person ${i + 1}`) : `Person ${i + 1}`,
  }));

  return {
    stage: "receipt",
    name: "",
    people,
    namePeople,
    mode: "simple",
    items: [],
    date: todayISODate(),
    contributions: [],
    currency: DEFAULT_CURRENCY,
  };
}
