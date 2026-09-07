/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

// The backfill re-keys seats from the inline UUIDs they used to carry onto
// their `tabMembers` row ids. The risk it has to answer for is not the roster
// - it is the expense fields that also hold a seat id, which would silently
// stop resolving if the rewrite missed one.

const modules = import.meta.glob("./**/*.ts");
const rate = { mode: "amount" as const, value: 0 };

/** A tab shaped the way tabs were before seats had rows: ids are bare UUIDs. */
async function seedLegacyTab(t: ReturnType<typeof convexTest>, ownerId: string) {
  return await t.run(async (ctx) => {
    const alexSeat = "11111111-1111-4111-8111-111111111111";
    const guestSeat = "22222222-2222-4222-8222-222222222222";
    const tabId = await ctx.db.insert("tabs", {
      slug: "trip",
      ownerUserId: ownerId as never,
      name: "Trip",
      defaultCurrency: "USD",
      updatedAt: 0,
      members: [
        { id: alexSeat, name: "Alex", claimedByUserId: ownerId as never, inviteToken: "tok-alex" },
        { id: guestSeat, name: "Guest", inviteToken: "tok-guest" },
      ],
    });
    // A claimed member is known to the expense by their account id; an
    // anonymous one by their seat id. Both appear here on purpose.
    const expenseId = await ctx.db.insert("expenses", {
      slug: "dinner", userId: ownerId as never, stage: "receipt", name: "Dinner",
      namePeople: true, mode: "simple", date: "2026-09-07", currency: "USD", updatedAt: 0,
      tabId,
      people: [{ id: ownerId, name: "Alex" }, { id: guestSeat, name: "Guest" }],
      items: [{ id: "i1", name: "Dinner", cost: 30, splitWith: [ownerId, guestSeat], discount: rate, tax: rate, tip: rate }],
      contributions: [{ personId: guestSeat, amount: { mode: "amount", value: 30 } }],
      tabMemberIds: [
        { personId: ownerId, memberId: alexSeat },
        { personId: guestSeat, memberId: guestSeat },
      ],
    });
    return { tabId, expenseId, alexSeat, guestSeat };
  });
}

test("backfill re-keys the roster and every expense reference onto row ids", async () => {
  const t = convexTest(schema, modules);
  const ownerId = await t.run(ctx => ctx.db.insert("users", { name: "Alex" }));
  const seeded = await seedLegacyTab(t, ownerId);

  const result = await t.mutation(internal.migrations.backfillSeatRows, {});
  expect(result).toEqual({ tabsMigrated: 1, tabsSkipped: 0, seatsCreated: 2, expensesRewritten: 1 });

  const { tab, expense, seats } = await t.run(async (ctx) => ({
    tab: (await ctx.db.get(seeded.tabId))!,
    expense: (await ctx.db.get(seeded.expenseId))!,
    seats: await ctx.db.query("tabMembers").collect(),
  }));

  // Every seat id in the roster is now a real row id.
  for (const member of tab.members) {
    expect(seats.some(s => s._id === member.id), `${member.name} is not a row id`).toBe(true);
  }
  const guest = seats.find(s => s.name === "Guest")!;
  const alex = seats.find(s => s.name === "Alex")!;
  expect(alex.userId).toBe(ownerId);
  expect(guest.userId).toBeUndefined();
  // Tokens survive, so invite links already sent still work.
  expect(guest.inviteToken).toBe("tok-guest");

  // The anonymous member's id is rewritten everywhere it appears...
  expect(expense.people.find(p => p.name === "Guest")!.id).toBe(guest._id);
  expect(expense.items[0].splitWith).toContain(guest._id);
  expect(expense.contributions[0].personId).toBe(guest._id);
  expect(expense.tabMemberIds!.find(l => l.memberId === guest._id)).toBeTruthy();
  // ...and the old UUID survives nowhere.
  expect(JSON.stringify(expense)).not.toContain(seeded.guestSeat);
  expect(JSON.stringify(tab)).not.toContain(seeded.guestSeat);

  // A claimed member was always known to the expense by account id, so that
  // is left alone - only the seat reference moves.
  expect(expense.people.find(p => p.name === "Alex")!.id).toBe(ownerId);
  expect(expense.tabMemberIds!.find(l => l.personId === ownerId)!.memberId).toBe(alex._id);
});

test("backfill is idempotent and leaves already-keyed tabs alone", async () => {
  const t = convexTest(schema, modules);
  const ownerId = await t.run(ctx => ctx.db.insert("users", { name: "Alex" }));
  await seedLegacyTab(t, ownerId);

  await t.mutation(internal.migrations.backfillSeatRows, {});
  const first = await t.run(ctx => ctx.db.query("tabMembers").collect());

  const second = await t.mutation(internal.migrations.backfillSeatRows, {});
  expect(second).toEqual({ tabsMigrated: 0, tabsSkipped: 1, seatsCreated: 0, expensesRewritten: 0 });

  const after = await t.run(ctx => ctx.db.query("tabMembers").collect());
  expect(after.map(r => r._id).sort()).toEqual(first.map(r => r._id).sort());
});

test("a migrated tab still works through the normal mutations", async () => {
  const t = convexTest(schema, modules);
  const ownerId = await t.run(ctx => ctx.db.insert("users", { name: "Alex" }));
  await seedLegacyTab(t, ownerId);
  await t.mutation(internal.migrations.backfillSeatRows, {});

  const user = t.withIdentity({ subject: `${ownerId}|session` });
  const guest = (await t.run(ctx => ctx.db.query("tabMembers").collect())).find(s => s.name === "Guest")!;

  // Renaming and removing resolve the seat through its row, which only works
  // because the roster now holds row ids.
  await user.mutation(api.tabs.renameMember, { slug: "trip", memberId: guest._id, name: "Renamed" });
  expect((await t.run(ctx => ctx.db.get(guest._id)))!.name).toBe("Renamed");

  await user.mutation(api.tabs.removeMember, { slug: "trip", memberId: guest._id });
  expect(await t.run(ctx => ctx.db.get(guest._id))).toBeNull();

  // And the breakdown still resolves the surviving member.
  const breakdown = await user.query(api.tabs.breakdown, { slug: "trip" });
  expect(breakdown!.currencies[0].members.map(m => m.name)).toEqual(["Alex"]);
});
