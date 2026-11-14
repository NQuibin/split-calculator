import { ConvexError } from "convex/values";

export const entryKinds = { event: "Event", flight: "Flight", lodging: "Lodging" } as const;

export type EntryFields = {
  title: string;
  date: string;
  time: string;
  kind: keyof typeof entryKinds;
  details: string;
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
