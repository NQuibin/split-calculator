import type { Person } from "./types";

/** An expense's custom name if set, otherwise its people's names joined together. */
export function expenseLabel(name: string | undefined, people: Person[]): string {
  return name?.trim() || people.map((p) => p.name).join(", ");
}
