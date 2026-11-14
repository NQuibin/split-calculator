import { ConvexError } from "convex/values";

import type { EntryKind } from "./itineraryCategories";

export type EntryFields = {
  title: string;
  date: string;
  time: string;
  kind: EntryKind;
  subtype?: string;
  details: string;
  cost?: { amount: number; currency: string; basis: "per_person" | "total" };
  flight?: {
    number?: string;
    departureTime?: string;
    arrivalTime?: string;
    departureCity?: string;
    departureAirportCode?: string;
    destinationCity?: string;
    destinationAirportCode?: string;
  };
  lodging?: { checkIn?: string; checkOut?: string; checkInDate?: string; checkOutDate?: string };
  location?: { name: string; url?: string };
};

export function itineraryError(error: unknown, fallback: string) {
  return error instanceof ConvexError && typeof error.data === "string" ? error.data : fallback;
}
