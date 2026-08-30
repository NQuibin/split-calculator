import type { Person, ReceiptState } from "./types";

// A brand-new receipt isn't persisted until its first item is added (see
// storage.ts), so its starting people/namePeople travel in the URL instead.
// Person.id is always `person-${index + 1}` (see StageHeadcount), so only
// the count and, when custom-named, the names need to be encoded - not full
// Person objects - to keep the query string short as headcount grows.

export function encodeDraftParams(people: Person[], namePeople: boolean): URLSearchParams {
  const params = new URLSearchParams({ count: String(people.length) });
  if (namePeople) {
    params.set("names", people.map((p) => encodeURIComponent(p.name)).join(","));
  }
  return params;
}

export function draftFromParams(params: URLSearchParams): ReceiptState | null {
  const count = Number(params.get("count"));
  if (!Number.isInteger(count) || count <= 0) return null;

  const namesParam = params.get("names");
  const namePeople = namesParam !== null;
  const names = namePeople ? namesParam.split(",").map((n) => decodeURIComponent(n)) : [];

  const people: Person[] = Array.from({ length: count }, (_, i) => ({
    id: `person-${i + 1}`,
    name: namePeople ? (names[i] ?? `Person ${i + 1}`) : `Person ${i + 1}`,
  }));

  return {
    stage: "receipt",
    people,
    namePeople,
    items: [],
    tax: { mode: "percent", value: 0 },
    tip: { mode: "percent", value: 0 },
  };
}
