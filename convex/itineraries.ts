import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./authz";
import { costaRica } from "../src/lib/costaRicaItinerary";
import { isValidISODate } from "../src/lib/format";
import { entrySubtypes } from "../src/lib/itineraryCategories";
import type { EntryKind } from "../src/lib/itineraryCategories";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const entryValidator = v.object({
  date: v.string(),
  time: v.string(),
  title: v.string(),
  kind: v.union(
    v.literal("travel"),
    v.literal("flight"),
    v.literal("lodging"),
    v.literal("event"),
    v.literal("food"),
    v.literal("activity"),
    v.literal("attraction"),
    v.literal("shop"),
  ),
  subtype: v.optional(v.string()),
  details: v.string(),
  location: v.optional(v.object({ name: v.string(), url: v.optional(v.string()) })),
  lodging: v.optional(
    v.object({
      checkIn: v.optional(v.string()),
      checkOut: v.optional(v.string()),
      checkInDate: v.optional(v.string()),
      checkOutDate: v.optional(v.string()),
    }),
  ),
  flight: v.optional(
    v.object({
      number: v.optional(v.string()),
      departureTime: v.optional(v.string()),
      arrivalTime: v.optional(v.string()),
      departureCity: v.optional(v.string()),
      departureAirportCode: v.optional(v.string()),
      destinationCity: v.optional(v.string()),
      destinationAirportCode: v.optional(v.string()),
    }),
  ),
});
const MAX_ENTRIES = 500;

function assertDate(date: string) {
  if (!isValidISODate(date)) {
    throw new ConvexError("Dates must be valid YYYY-MM-DD values");
  }
}

function validateRange(startDate: string, endDate: string) {
  assertDate(startDate);
  assertDate(endDate);
  if (startDate > endDate) throw new ConvexError("End date must be on or after start date");
}

function normalizeSubtype(entry: { kind: EntryKind; subtype?: string }) {
  if (entry.subtype === undefined) return undefined;
  const subtype = entry.subtype.trim();
  if (!subtype) return undefined;
  if (!entrySubtypes[entry.kind].some((value) => value === subtype)) {
    throw new ConvexError("Subtype is not valid for this entry kind");
  }
  return subtype;
}

function validateEntry(
  entry: {
    date: string;
    time: string;
    title: string;
    details: string;
  },
  startDate: string,
  endDate: string,
) {
  assertDate(entry.date);
  if (entry.date < startDate || entry.date > endDate)
    throw new ConvexError("Entry date must be within the itinerary dates");
  if (entry.time !== "" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.time)) {
    throw new ConvexError("Time must be empty or a valid 24-hour HH:mm value");
  }
  if (!entry.title.trim() || entry.title.length > 200 || entry.details.length > 4000) {
    throw new ConvexError("Entry title or details exceed allowed bounds");
  }
}

function normalizeLocation(entry: {
  kind: EntryKind;
  subtype?: string;
  location?: { name: string; url?: string };
}) {
  if (!entry.location) return undefined;
  const name = entry.location.name.trim();
  const url = entry.location.url?.trim();
  if (entry.kind === "travel" && entry.subtype === "flight") {
    throw new ConvexError("Location is not allowed for flights");
  }
  if (!name) {
    if (url) throw new ConvexError("A location URL requires a location name");
    return undefined;
  }
  if (name.length > 200 || (url && url.length > 2000)) {
    throw new ConvexError("Location name or URL exceeds allowed bounds");
  }
  if (url) {
    try {
      const parsed = new URL(url);
      if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || !parsed.hostname) {
        throw new Error("Invalid protocol");
      }
    } catch {
      throw new ConvexError("Location URL must be an absolute HTTP or HTTPS URL");
    }
  }
  return { name, ...(url ? { url } : {}) };
}

function normalizeLodging(entry: {
  kind: EntryKind;
  lodging?: {
    checkIn?: string;
    checkOut?: string;
    checkInDate?: string;
    checkOutDate?: string;
  };
}) {
  if (!entry.lodging) return undefined;
  if (entry.kind !== "lodging")
    throw new ConvexError("Lodging details are only allowed for lodging");
  const checkIn = entry.lodging.checkIn?.trim();
  const checkOut = entry.lodging.checkOut?.trim();
  const checkInDate = entry.lodging.checkInDate?.trim();
  const checkOutDate = entry.lodging.checkOutDate?.trim();
  for (const value of [checkIn, checkOut]) {
    if (value && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      throw new ConvexError("Check-in and check-out times must be valid 24-hour HH:mm values");
    }
  }
  for (const value of [checkInDate, checkOutDate]) {
    if (value && !isValidISODate(value)) {
      throw new ConvexError("Check-in and check-out dates must be valid YYYY-MM-DD values");
    }
  }
  if (checkInDate && checkOutDate && checkOutDate < checkInDate) {
    throw new ConvexError("Check-out date must be on or after check-in date");
  }
  if (!checkIn && !checkOut && !checkInDate && !checkOutDate) return undefined;
  return {
    ...(checkIn ? { checkIn } : {}),
    ...(checkOut ? { checkOut } : {}),
    ...(checkInDate ? { checkInDate } : {}),
    ...(checkOutDate ? { checkOutDate } : {}),
  };
}

function normalizeFlight(entry: {
  kind: EntryKind;
  subtype?: string;
  flight?: {
    number?: string;
    departureTime?: string;
    arrivalTime?: string;
    departureCity?: string;
    departureAirportCode?: string;
    destinationCity?: string;
    destinationAirportCode?: string;
  };
}) {
  if (!entry.flight) return undefined;
  if (entry.kind !== "travel" || entry.subtype !== "flight") {
    throw new ConvexError("Flight details are only allowed for flights");
  }
  const number = entry.flight.number?.trim();
  const departureTime = entry.flight.departureTime?.trim();
  const arrivalTime = entry.flight.arrivalTime?.trim();
  const departureCity = entry.flight.departureCity?.trim();
  const departureAirportCodeInput = entry.flight.departureAirportCode?.trim();
  const departureAirportCode = departureAirportCodeInput?.toUpperCase();
  const destinationCity = entry.flight.destinationCity?.trim();
  const destinationAirportCodeInput = entry.flight.destinationAirportCode?.trim();
  const destinationAirportCode = destinationAirportCodeInput?.toUpperCase();
  if (number && number.length > 32)
    throw new ConvexError("Flight number must be at most 32 characters");
  if (departureTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(departureTime)) {
    throw new ConvexError("Departure time must be a valid 24-hour HH:mm value");
  }
  if (arrivalTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(arrivalTime)) {
    throw new ConvexError("Arrival time must be a valid 24-hour HH:mm value");
  }
  if (departureCity && departureCity.length > 100) {
    throw new ConvexError("Departure city must be at most 100 characters");
  }
  if (destinationCity && destinationCity.length > 100) {
    throw new ConvexError("Destination city must be at most 100 characters");
  }
  for (const [input, code] of [
    [departureAirportCodeInput, departureAirportCode],
    [destinationAirportCodeInput, destinationAirportCode],
  ]) {
    if (code && (!/^[A-Za-z0-9]{3,4}$/.test(input ?? "") || !/^[A-Z0-9]{3,4}$/.test(code))) {
      throw new ConvexError("Airport codes must be 3–4 ASCII letters or numbers");
    }
  }
  if (
    !number &&
    !departureTime &&
    !arrivalTime &&
    !departureCity &&
    !departureAirportCode &&
    !destinationCity &&
    !destinationAirportCode
  )
    return undefined;
  return {
    ...(number ? { number } : {}),
    ...(departureTime ? { departureTime } : {}),
    ...(arrivalTime ? { arrivalTime } : {}),
    ...(departureCity ? { departureCity } : {}),
    ...(departureAirportCode ? { departureAirportCode } : {}),
    ...(destinationCity ? { destinationCity } : {}),
    ...(destinationAirportCode ? { destinationAirportCode } : {}),
  };
}

async function ownedItinerary(ctx: QueryCtx | MutationCtx, id: Id<"itineraries">) {
  const userId = await requireUserId(ctx);
  const itinerary = await ctx.db.get(id);
  if (itinerary?.userId !== userId) throw new ConvexError("Not authorized");
  return itinerary;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const docs = await ctx.db
      .query("itineraries")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return docs.map(({ _id, title, startDate, endDate, importedCostaRica }) => ({
      _id,
      title,
      startDate,
      endDate,
      isCostaRica: importedCostaRica === true,
    }));
  },
});

export const get = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const itineraryId = ctx.db.normalizeId("itineraries", id);
    if (!itineraryId) return null;
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const doc = await ctx.db.get(itineraryId);
    if (doc?.userId !== userId) return null;
    const entries = await ctx.db
      .query("itineraryEntries")
      .withIndex("by_itinerary", (q) => q.eq("itineraryId", itineraryId))
      .collect();
    return {
      _id: doc._id,
      title: doc.title,
      startDate: doc.startDate,
      endDate: doc.endDate,
      entries: entries.map(
        ({ entryId, date, time, title, kind, subtype, details, location, flight, lodging }) => ({
          id: entryId,
          date,
          time,
          title,
          kind: kind === "flight" ? "travel" : kind,
          subtype: kind === "flight" ? "flight" : subtype,
          details,
          location,
          flight,
          lodging,
        }),
      ),
    };
  },
});

export const create = mutation({
  args: { title: v.string(), startDate: v.string(), endDate: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    validateRange(args.startDate, args.endDate);
    if (!args.title.trim() || args.title.length > 200)
      throw new ConvexError("Title must contain 1–200 characters");
    return await ctx.db.insert("itineraries", { userId, ...args });
  },
});

export const update = mutation({
  args: { id: v.id("itineraries"), title: v.string(), startDate: v.string(), endDate: v.string() },
  handler: async (ctx, { id, ...changes }) => {
    const doc = await ownedItinerary(ctx, id);
    validateRange(changes.startDate, changes.endDate);
    if (!changes.title.trim() || changes.title.length > 200)
      throw new ConvexError("Title must contain 1–200 characters");
    const entries = await ctx.db
      .query("itineraryEntries")
      .withIndex("by_itinerary", (q) => q.eq("itineraryId", id))
      .collect();
    if (entries.some((entry) => entry.date < changes.startDate || entry.date > changes.endDate)) {
      throw new ConvexError("Updated dates must include every saved entry");
    }
    await ctx.db.patch(doc._id, changes);
    return null;
  },
});

export const saveEntry = mutation({
  args: { id: v.id("itineraries"), entryId: v.optional(v.string()), entry: entryValidator },
  handler: async (ctx, { id, entryId, entry }) => {
    const itinerary = await ownedItinerary(ctx, id);
    validateEntry(entry, itinerary.startDate, itinerary.endDate);
    const normalizedEntry = {
      ...entry,
      kind: entry.kind === "flight" ? ("travel" as const) : entry.kind,
      subtype: entry.kind === "flight" ? "flight" : entry.subtype,
    };
    const subtype = normalizeSubtype(normalizedEntry);
    const location = normalizeLocation({ ...normalizedEntry, subtype });
    const flight = normalizeFlight({ ...normalizedEntry, subtype });
    const lodging = normalizeLodging(normalizedEntry);
    const savedEntry = { ...normalizedEntry, subtype, location, flight, lodging };
    const existing = entryId
      ? await ctx.db
          .query("itineraryEntries")
          .withIndex("by_itinerary_and_entryId", (q) =>
            q.eq("itineraryId", id).eq("entryId", entryId),
          )
          .unique()
      : null;
    if (entryId !== undefined) {
      if (!existing)
        throw new ConvexError("This entry was removed. Refresh the itinerary and try again.");
      await ctx.db.patch(existing._id, savedEntry);
      return null;
    }
    const entries = await ctx.db
      .query("itineraryEntries")
      .withIndex("by_itinerary", (q) => q.eq("itineraryId", id))
      .take(MAX_ENTRIES);
    if (entries.length >= MAX_ENTRIES)
      throw new ConvexError("An itinerary can contain at most 500 entries");
    await ctx.db.insert("itineraryEntries", {
      ...savedEntry,
      entryId: crypto.randomUUID(),
      itineraryId: id,
    });
    return null;
  },
});

export const removeEntry = mutation({
  args: { id: v.id("itineraries"), entryId: v.string() },
  handler: async (ctx, { id, entryId }) => {
    await ownedItinerary(ctx, id);
    const entry = await ctx.db
      .query("itineraryEntries")
      .withIndex("by_itinerary_and_entryId", (q) => q.eq("itineraryId", id).eq("entryId", entryId))
      .unique();
    if (entry) await ctx.db.delete(entry._id);
    return null;
  },
});

export const importCostaRica = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const seeded = await ctx.db
      .query("itineraries")
      .withIndex("by_user_and_importedCostaRica", (q) =>
        q.eq("userId", userId).eq("importedCostaRica", true),
      )
      .unique();
    if (seeded) return seeded._id;
    validateRange(costaRica.startDate, costaRica.endDate);
    if (costaRica.entries.length > MAX_ENTRIES)
      throw new ConvexError("Seed itinerary exceeds allowed entry count");
    const id = await ctx.db.insert("itineraries", {
      userId,
      title: costaRica.title,
      startDate: costaRica.startDate,
      endDate: costaRica.endDate,
      importedCostaRica: true,
    });
    for (const entry of costaRica.entries) {
      validateEntry(entry, costaRica.startDate, costaRica.endDate);
      await ctx.db.insert("itineraryEntries", {
        ...entry,
        entryId: crypto.randomUUID(),
        itineraryId: id,
      });
    }
    return id;
  },
});
