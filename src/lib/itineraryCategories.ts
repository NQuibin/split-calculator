export const entryKinds = {
  food: "Food",
  activity: "Activity",
  attraction: "Attraction",
  shop: "Shop",
  travel: "Travel",
  lodging: "Lodging",
  event: "Other",
} as const;

export type EntryKind = keyof typeof entryKinds;

export const entrySubtypes = {
  food: ["breakfast", "lunch", "dinner", "snack", "dessert"],
  activity: ["museum", "tour"],
  attraction: ["viewpoint", "landmark"],
  shop: ["mall", "standalone"],
  travel: ["flight", "bus", "train", "ferry", "car", "walk"],
  lodging: ["hotel", "bnb", "hostel"],
  event: [],
} as const satisfies Record<EntryKind, readonly string[]>;

export function subtypeLabel(subtype: string) {
  if (subtype === "bnb") return "BnB";
  return subtype.charAt(0).toUpperCase() + subtype.slice(1);
}
