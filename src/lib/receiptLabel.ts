import type { Person } from "./types";

/** A receipt's custom name if set, otherwise its people's names joined together. */
export function receiptLabel(name: string | undefined, people: Person[]): string {
  return name?.trim() || people.map((p) => p.name).join(", ");
}
