import { DEFAULT_CURRENCY } from "./currencies";
import { todayISODate } from "./format";
import type { Person, ExpenseState } from "./types";

// A brand-new expense isn't persisted until its first item is added (see
// storage.ts), so its starting people/namePeople travel in the URL instead.
// Person.id is normally regenerated as `person-${index + 1}` on the other
// end (see reducer.ts's ADD_PERSON) - real ids only need to survive the
// round-trip for a person already tied to a real account (the signed-in
// starter, or a tab member claimed by one), so a real user's own name stays
// locked from the very first render instead of only after saving. Those are
// encoded via `ids`, aligned by position with `names`; omitted entirely when
// nobody has one, to keep the common case's query string short.

function isGeneratedId(id: string, index: number): boolean {
  return id === `person-${index + 1}`;
}

export function encodeDraftParams(people: Person[], namePeople: boolean): URLSearchParams {
  const params = new URLSearchParams({ count: String(people.length) });
  if (namePeople) {
    params.set("names", people.map((p) => encodeURIComponent(p.name)).join(","));
  }
  if (people.some((p, i) => !isGeneratedId(p.id, i))) {
    params.set("ids", people.map((p) => encodeURIComponent(p.id)).join(","));
  }
  return params;
}

export function draftFromParams(params: URLSearchParams): ExpenseState | null {
  const count = Number(params.get("count"));
  if (!Number.isInteger(count) || count <= 0) return null;

  const namesParam = params.get("names");
  const namePeople = namesParam !== null;
  const names = namePeople ? namesParam.split(",").map((n) => decodeURIComponent(n)) : [];
  const idsParam = params.get("ids");
  const ids = idsParam ? idsParam.split(",").map((id) => decodeURIComponent(id)) : [];

  const people: Person[] = Array.from({ length: count }, (_, i) => ({
    id: ids[i] || `person-${i + 1}`,
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
