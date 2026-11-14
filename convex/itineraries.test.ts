/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  const alexId = await t.run((ctx) => ctx.db.insert("users", { name: "Alex" }));
  const samId = await t.run((ctx) => ctx.db.insert("users", { name: "Sam" }));
  return {
    alex: t.withIdentity({ subject: `${alexId}|session` }),
    sam: t.withIdentity({ subject: `${samId}|session` }),
  };
}

test("itineraries are private and entries are editable by stable entry id", async () => {
  const { alex, sam } = await setup();
  const id = await alex.mutation(api.itineraries.create, {
    title: "Trip",
    startDate: "2026-12-01",
    endDate: "2026-12-03",
  });
  expect(await alex.query(api.itineraries.list, {})).toMatchObject([{ _id: id, title: "Trip" }]);
  expect(await sam.query(api.itineraries.list, {})).toEqual([]);
  expect(await sam.query(api.itineraries.get, { id })).toBeNull();
  await expect(
    sam.mutation(api.itineraries.update, {
      id,
      title: "Stolen",
      startDate: "2026-12-01",
      endDate: "2026-12-03",
    }),
  ).rejects.toThrow("Not authorized");

  await alex.mutation(api.itineraries.saveEntry, {
    id,
    entry: { date: "2026-12-01", time: "", title: "Flight", kind: "flight", details: "Arrive" },
  });
  const entries = (await alex.query(api.itineraries.get, { id }))?.entries ?? [];
  expect(entries).toEqual([
    {
      id: expect.any(String),
      date: "2026-12-01",
      time: "",
      title: "Flight",
      kind: "travel",
      subtype: "flight",
      details: "Arrive",
    },
  ]);
  await alex.mutation(api.itineraries.saveEntry, {
    id,
    entryId: entries[0].id,
    entry: {
      date: "2026-12-02",
      time: "09:30",
      title: "Updated flight",
      kind: "flight",
      details: "",
    },
  });
  expect((await alex.query(api.itineraries.get, { id }))?.entries).toHaveLength(1);
  await expect(
    sam.mutation(api.itineraries.removeEntry, { id, entryId: entries[0].id }),
  ).rejects.toThrow("Not authorized");
  await alex.mutation(api.itineraries.removeEntry, { id, entryId: entries[0].id });
  expect((await alex.query(api.itineraries.get, { id }))?.entries).toEqual([]);
});

test("Costa Rica import is idempotent for each owner", async () => {
  const { alex, sam } = await setup();
  const first = await alex.mutation(api.itineraries.importCostaRica, {});
  const second = await alex.mutation(api.itineraries.importCostaRica, {});
  const otherOwner = await sam.mutation(api.itineraries.importCostaRica, {});
  expect(second).toBe(first);
  expect(otherOwner).not.toBe(first);
  const imported = await alex.query(api.itineraries.get, { id: first });
  expect(imported).toMatchObject({ startDate: "2026-11-17", endDate: "2026-11-24" });
  expect(imported?.entries).toHaveLength(36);
  expect(new Set(imported?.entries.map((entry) => entry.date)).size).toBe(8);
  expect(imported?.entries[0]).toMatchObject({ kind: "travel", subtype: "flight", time: "12:35" });
  expect(
    (await alex.query(api.itineraries.list, {})).filter((row) => row.isCostaRica),
  ).toHaveLength(1);
});

test("date, time, and itinerary ranges are validated", async () => {
  const { alex } = await setup();
  const id = await alex.mutation(api.itineraries.create, {
    title: "Trip",
    startDate: "2026-12-01",
    endDate: "2026-12-03",
  });
  await expect(
    alex.mutation(api.itineraries.update, {
      id,
      title: "Trip",
      startDate: "2026-12-04",
      endDate: "2026-12-03",
    }),
  ).rejects.toThrow("End date");
  await expect(
    alex.mutation(api.itineraries.saveEntry, {
      id,
      entry: { date: "2026-12-04", time: "99:00", title: "Oops", kind: "event", details: "" },
    }),
  ).rejects.toThrow("within the itinerary dates");
  await expect(
    alex.mutation(api.itineraries.saveEntry, {
      id,
      entry: { date: "2026-12-03", time: "25:00", title: "Oops", kind: "event", details: "" },
    }),
  ).rejects.toThrow("HH:mm");
});

test("event and lodging locations are trimmed; flight locations are rejected", async () => {
  const { alex } = await setup();
  const id = await alex.mutation(api.itineraries.create, {
    title: "Trip",
    startDate: "2026-12-01",
    endDate: "2026-12-03",
  });
  await alex.mutation(api.itineraries.saveEntry, {
    id,
    entry: {
      date: "2026-12-01",
      time: "",
      title: "Concert",
      kind: "event",
      details: "",
      location: { name: "  Main Hall  ", url: "  https://example.com/venue  " },
    },
  });
  const saved = (await alex.query(api.itineraries.get, { id }))?.entries[0];
  expect(saved?.location).toEqual({ name: "Main Hall", url: "https://example.com/venue" });
  await alex.mutation(api.itineraries.saveEntry, {
    id,
    entryId: saved?.id,
    entry: {
      date: "2026-12-01",
      time: "",
      title: "Concert",
      kind: "event",
      details: "",
    },
  });
  expect((await alex.query(api.itineraries.get, { id }))?.entries[0].location).toBeUndefined();

  await alex.mutation(api.itineraries.saveEntry, {
    id,
    entry: {
      date: "2026-12-01",
      time: "",
      title: "Hotel",
      kind: "lodging",
      details: "",
      location: { name: "  Hotel  " },
    },
  });
  expect((await alex.query(api.itineraries.get, { id }))?.entries[1].location).toEqual({
    name: "Hotel",
  });

  await expect(
    alex.mutation(api.itineraries.saveEntry, {
      id,
      entry: {
        date: "2026-12-01",
        time: "",
        title: "Concert",
        kind: "event",
        details: "",
        location: { name: "Hall", url: "javascript:alert(1)" },
      },
    }),
  ).rejects.toThrow("absolute HTTP or HTTPS");
  await expect(
    alex.mutation(api.itineraries.saveEntry, {
      id,
      entry: {
        date: "2026-12-01",
        time: "",
        title: "Concert",
        kind: "event",
        details: "",
        location: { name: "  ", url: "https://example.com" },
      },
    }),
  ).rejects.toThrow("requires a location name");
});

test("lodging times are normalized, validated, returned, and cleared", async () => {
  const { alex } = await setup();
  const id = await alex.mutation(api.itineraries.create, {
    title: "Trip",
    startDate: "2026-12-01",
    endDate: "2026-12-03",
  });
  await alex.mutation(api.itineraries.saveEntry, {
    id,
    entry: {
      date: "2026-12-01",
      time: "",
      title: "Hotel",
      kind: "lodging",
      details: "",
      lodging: { checkIn: " 15:00 ", checkOut: "11:30" },
    },
  });
  const saved = (await alex.query(api.itineraries.get, { id }))?.entries[0];
  expect(saved?.lodging).toEqual({ checkIn: "15:00", checkOut: "11:30" });
  await expect(
    alex.mutation(api.itineraries.saveEntry, {
      id,
      entry: {
        date: "2026-12-01",
        time: "",
        title: "Hotel",
        kind: "lodging",
        details: "",
        lodging: { checkIn: "24:00" },
      },
    }),
  ).rejects.toThrow("HH:mm");
  await expect(
    alex.mutation(api.itineraries.saveEntry, {
      id,
      entry: {
        date: "2026-12-01",
        time: "",
        title: "Event",
        kind: "event",
        details: "",
        lodging: { checkIn: "15:00" },
      },
    }),
  ).rejects.toThrow("only allowed for lodging");
  await alex.mutation(api.itineraries.saveEntry, {
    id,
    entryId: saved?.id,
    entry: {
      date: "2026-12-01",
      time: "",
      title: "Hotel",
      kind: "lodging",
      details: "",
      lodging: { checkIn: " ", checkOut: "" },
    },
  });
  expect((await alex.query(api.itineraries.get, { id }))?.entries[0].lodging).toBeUndefined();
});

test("flight details are normalized, independently optional, and cleared on save", async () => {
  const { alex } = await setup();
  const id = await alex.mutation(api.itineraries.create, {
    title: "Trip",
    startDate: "2026-12-01",
    endDate: "2026-12-03",
  });
  await alex.mutation(api.itineraries.saveEntry, {
    id,
    entry: {
      date: "2026-12-01",
      time: "",
      title: "Flight",
      kind: "flight",
      details: "",
      flight: { number: "  AC 123  ", departureTime: " 09:45 " },
    },
  });
  const saved = (await alex.query(api.itineraries.get, { id }))?.entries[0];
  expect(saved?.flight).toEqual({ number: "AC 123", departureTime: "09:45" });
  await alex.mutation(api.itineraries.saveEntry, {
    id,
    entryId: saved?.id,
    entry: {
      date: "2026-12-01",
      time: "",
      title: "Flight",
      kind: "flight",
      details: "",
      flight: { number: "  ZX9  " },
    },
  });
  expect((await alex.query(api.itineraries.get, { id }))?.entries[0].flight).toEqual({
    number: "ZX9",
  });
  await alex.mutation(api.itineraries.saveEntry, {
    id,
    entryId: saved?.id,
    entry: {
      date: "2026-12-01",
      time: "",
      title: "Flight",
      kind: "flight",
      details: "",
      flight: { number: "  ", departureTime: "" },
    },
  });
  expect((await alex.query(api.itineraries.get, { id }))?.entries[0].flight).toBeUndefined();
});

test("flight details enforce flight number length, departure time, and entry kind", async () => {
  const { alex } = await setup();
  const id = await alex.mutation(api.itineraries.create, {
    title: "Trip",
    startDate: "2026-12-01",
    endDate: "2026-12-03",
  });
  const base = { date: "2026-12-01", time: "", title: "Entry", details: "" };
  await expect(
    alex.mutation(api.itineraries.saveEntry, {
      id,
      entry: { ...base, kind: "flight", flight: { number: "F".repeat(33) } },
    }),
  ).rejects.toThrow("at most 32");
  await expect(
    alex.mutation(api.itineraries.saveEntry, {
      id,
      entry: { ...base, kind: "flight", flight: { departureTime: "24:00" } },
    }),
  ).rejects.toThrow("HH:mm");
  await expect(
    alex.mutation(api.itineraries.saveEntry, {
      id,
      entry: { ...base, kind: "event", flight: { number: "AC 1" } },
    }),
  ).rejects.toThrow("only allowed for flights");
});

test("flight arrival time is validated and lodging dates allow bookings outside the itinerary", async () => {
  const { alex } = await setup();
  const id = await alex.mutation(api.itineraries.create, {
    title: "Trip",
    startDate: "2026-12-01",
    endDate: "2026-12-03",
  });
  const base = { date: "2026-12-01", time: "", title: "Entry", details: "" };
  await alex.mutation(api.itineraries.saveEntry, {
    id,
    entry: { ...base, kind: "flight", flight: { arrivalTime: " 23:59 " } },
  });
  const flight = (await alex.query(api.itineraries.get, { id }))?.entries[0];
  expect(flight?.flight).toEqual({ arrivalTime: "23:59" });
  await expect(
    alex.mutation(api.itineraries.saveEntry, {
      id,
      entry: { ...base, kind: "flight", flight: { arrivalTime: "24:00" } },
    }),
  ).rejects.toThrow("HH:mm");

  await alex.mutation(api.itineraries.saveEntry, {
    id,
    entry: {
      ...base,
      kind: "lodging",
      lodging: { checkInDate: "2026-11-30", checkOutDate: "2026-12-04" },
    },
  });
  const lodging = (await alex.query(api.itineraries.get, { id }))?.entries[1];
  expect(lodging?.lodging).toEqual({ checkInDate: "2026-11-30", checkOutDate: "2026-12-04" });
  await expect(
    alex.mutation(api.itineraries.saveEntry, {
      id,
      entry: { ...base, kind: "lodging", lodging: { checkInDate: "2026-02-30" } },
    }),
  ).rejects.toThrow("YYYY-MM-DD");
  await expect(
    alex.mutation(api.itineraries.saveEntry, {
      id,
      entry: {
        ...base,
        kind: "lodging",
        lodging: { checkInDate: "2026-12-03", checkOutDate: "2026-12-02" },
      },
    }),
  ).rejects.toThrow("on or after");

  await alex.mutation(api.itineraries.saveEntry, {
    id,
    entryId: lodging?.id,
    entry: { ...base, kind: "lodging", lodging: { checkInDate: "2026-11-30" } },
  });
  expect((await alex.query(api.itineraries.get, { id }))?.entries[1].lodging).toEqual({
    checkInDate: "2026-11-30",
  });
});

test("flight route fields are independently optional, normalized, validated, and cleared on save", async () => {
  const { alex } = await setup();
  const id = await alex.mutation(api.itineraries.create, {
    title: "Trip",
    startDate: "2026-12-01",
    endDate: "2026-12-03",
  });
  const base = { date: "2026-12-01", time: "", title: "Flight", kind: "flight", details: "" };
  await alex.mutation(api.itineraries.saveEntry, {
    id,
    entry: {
      ...base,
      kind: "flight",
      flight: {
        departureCity: "  Toronto ",
        departureAirportCode: " yyz ",
        destinationCity: "",
        destinationAirportCode: "sfo",
      },
    },
  });
  const saved = (await alex.query(api.itineraries.get, { id }))?.entries[0];
  expect(saved?.flight).toEqual({
    departureCity: "Toronto",
    departureAirportCode: "YYZ",
    destinationAirportCode: "SFO",
  });
  await alex.mutation(api.itineraries.saveEntry, {
    id,
    entryId: saved?.id,
    entry: { ...base, kind: "flight", flight: { destinationCity: " Vancouver " } },
  });
  expect((await alex.query(api.itineraries.get, { id }))?.entries[0].flight).toEqual({
    destinationCity: "Vancouver",
  });
  await alex.mutation(api.itineraries.saveEntry, {
    id,
    entryId: saved?.id,
    entry: { ...base, kind: "flight", flight: { departureCity: "  ", destinationAirportCode: "" } },
  });
  expect((await alex.query(api.itineraries.get, { id }))?.entries[0].flight).toBeUndefined();
});

test("flight route fields enforce city length and airport code format", async () => {
  const { alex } = await setup();
  const id = await alex.mutation(api.itineraries.create, {
    title: "Trip",
    startDate: "2026-12-01",
    endDate: "2026-12-03",
  });
  const base = { date: "2026-12-01", time: "", title: "Flight", kind: "flight", details: "" };
  await expect(
    alex.mutation(api.itineraries.saveEntry, {
      id,
      entry: { ...base, kind: "flight", flight: { departureCity: "C".repeat(101) } },
    }),
  ).rejects.toThrow("at most 100");
  for (const code of ["AB", "ABCDE", "ÅBC", "ßBC", "A-C"]) {
    await expect(
      alex.mutation(api.itineraries.saveEntry, {
        id,
        entry: { ...base, kind: "flight", flight: { destinationAirportCode: code } },
      }),
    ).rejects.toThrow("Airport codes");
  }
});

test("older itinerary entries without locations remain readable", async () => {
  const { alex } = await setup();
  const id = await alex.mutation(api.itineraries.create, {
    title: "Trip",
    startDate: "2026-12-01",
    endDate: "2026-12-03",
  });
  await alex.run((ctx) =>
    ctx.db.insert("itineraryEntries", {
      itineraryId: id,
      entryId: "legacy",
      date: "2026-12-01",
      time: "",
      title: "Old event",
      kind: "event",
      details: "No location field",
    }),
  );
  expect((await alex.query(api.itineraries.get, { id }))?.entries[0]).toMatchObject({
    id: "legacy",
    title: "Old event",
  });
});

test("legacy flights read as travel flights and legacy saves persist in the new shape", async () => {
  const { alex } = await setup();
  const id = await alex.mutation(api.itineraries.create, {
    title: "Trip",
    startDate: "2026-12-01",
    endDate: "2026-12-03",
  });
  await alex.run((ctx) =>
    ctx.db.insert("itineraryEntries", {
      itineraryId: id,
      entryId: "legacy-flight",
      date: "2026-12-01",
      time: "",
      title: "Old flight",
      kind: "flight",
      details: "Keep these details",
      flight: { number: "AC 12", departureCity: "Toronto" },
    }),
  );
  const legacy = (await alex.query(api.itineraries.get, { id }))?.entries[0];
  expect(legacy).toMatchObject({
    id: "legacy-flight",
    kind: "travel",
    subtype: "flight",
    details: "Keep these details",
    flight: { number: "AC 12", departureCity: "Toronto" },
  });

  await alex.mutation(api.itineraries.saveEntry, {
    id,
    entry: {
      date: "2026-12-02",
      time: "",
      title: "New legacy payload",
      kind: "flight",
      details: "Saved through compatibility path",
      flight: { number: "ZX 9" },
    },
  });
  const entries = (await alex.query(api.itineraries.get, { id }))?.entries;
  expect(entries?.[1]).toMatchObject({
    kind: "travel",
    subtype: "flight",
    details: "Saved through compatibility path",
    flight: { number: "ZX 9" },
  });
  const stored = await alex.run((ctx) =>
    ctx.db
      .query("itineraryEntries")
      .withIndex("by_itinerary_and_entryId", (q) =>
        q.eq("itineraryId", id).eq("entryId", entries?.[1].id ?? ""),
      )
      .unique(),
  );
  expect(stored?.kind).toBe("travel");
});

test("travel flight metadata is restricted to flight subtype while other travel allows locations", async () => {
  const { alex } = await setup();
  const id = await alex.mutation(api.itineraries.create, {
    title: "Trip",
    startDate: "2026-12-01",
    endDate: "2026-12-03",
  });
  const base = { date: "2026-12-01", time: "", title: "Travel", details: "" };
  await alex.mutation(api.itineraries.saveEntry, {
    id,
    entry: { ...base, kind: "travel", subtype: "train", location: { name: "Union Station" } },
  });
  expect((await alex.query(api.itineraries.get, { id }))?.entries[0].location).toEqual({
    name: "Union Station",
  });
  await expect(
    alex.mutation(api.itineraries.saveEntry, {
      id,
      entry: { ...base, kind: "travel", subtype: "train", flight: { number: "AC 1" } },
    }),
  ).rejects.toThrow("only allowed for flights");
  await expect(
    alex.mutation(api.itineraries.saveEntry, {
      id,
      entry: { ...base, kind: "travel", subtype: "flight", location: { name: "Airport" } },
    }),
  ).rejects.toThrow("not allowed for flights");
});

test("new itinerary kinds persist and subtype values are kind-specific and cleared when omitted", async () => {
  const { alex } = await setup();
  const id = await alex.mutation(api.itineraries.create, {
    title: "Trip",
    startDate: "2026-12-01",
    endDate: "2026-12-03",
  });
  const base = { date: "2026-12-01", time: "", details: "" };
  const cases = [
    { kind: "food", subtype: "dinner" },
    { kind: "activity", subtype: "museum" },
    { kind: "attraction", subtype: "viewpoint" },
    { kind: "shop", subtype: "mall" },
    { kind: "event" },
    { kind: "travel", subtype: "flight" },
    { kind: "lodging" },
  ] as const;
  for (const [index, value] of cases.entries()) {
    await alex.mutation(api.itineraries.saveEntry, {
      id,
      entry: { ...base, title: `Entry ${index}`, ...value },
    });
  }
  const saved = (await alex.query(api.itineraries.get, { id }))?.entries;
  expect(saved?.map(({ kind, subtype }) => ({ kind, subtype }))).toEqual(cases);

  const food = saved?.[0];
  await expect(
    alex.mutation(api.itineraries.saveEntry, {
      id,
      entryId: food?.id,
      entry: { ...base, title: "Wrong subtype", kind: "food", subtype: "tour" },
    }),
  ).rejects.toThrow("Subtype is not valid");
  await alex.mutation(api.itineraries.saveEntry, {
    id,
    entryId: food?.id,
    entry: { ...base, title: "Dinner", kind: "food" },
  });
  expect((await alex.query(api.itineraries.get, { id }))?.entries[0].subtype).toBeUndefined();
});
