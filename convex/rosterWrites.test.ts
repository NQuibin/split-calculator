/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

// `tabMembers` is the roster outright: phase 4 stopped writing
// `tabs.members[]`, so there is no longer a mirror to keep in step. These
// tests cover the write paths that create, change and remove seats.

const modules = import.meta.glob("./**/*.ts");
const state = {
  name: "Dinner", mode: "simple" as const,
  date: "2026-09-07", currency: "USD", people: [{ id: "person-1", name: "Alex" }],
  items: [{ id: "total", name: "Dinner", cost: 30, splitWith: ["person-1"],
    discount: { mode: "amount" as const, value: 0 }, tax: { mode: "amount" as const, value: 0 }, tip: { mode: "amount" as const, value: 0 } }],
};

async function setup() {
  const t = convexTest(schema, modules);
  const userId = await t.run(ctx => ctx.db.insert("users", { name: "Alex" }));
  return { t, userId, user: t.withIdentity({ subject: `${userId}|session` }) };
}

type TestConvex = Awaited<ReturnType<typeof setup>>["t"];

/** Every seat row, in the creation order `by_tab` returns them in. */
async function seats(t: TestConvex) {
  return await t.run(ctx => ctx.db.query("tabMembers").collect());
}

test("a new tab seats the creator first, then everyone named", async () => {
  const { t, user, userId } = await setup();
  await user.mutation(api.tabs.create, { slug: "trip", name: "Trip", memberNames: ["Sam", "Jo"] });

  const roster = await seats(t);
  expect(roster).toHaveLength(3);
  // The creator is seated first, so creation order keeps them at the head.
  expect(roster.map(s => s.name)).toEqual(["Alex", "Sam", "Jo"]);
  expect(roster[0].userId).toBe(userId);
  expect(roster.slice(1).every(s => s.userId === undefined)).toBe(true);

  // And the read path reports that same order.
  const view = await user.query(api.tabs.getBySlug, { slug: "trip" });
  expect(view!.members.map(m => m.name)).toEqual(["Alex", "Sam", "Jo"]);
});

test("adding, renaming and removing a member all reach the rows", async () => {
  const { t, user } = await setup();
  await user.mutation(api.tabs.create, { slug: "trip", name: "Trip", memberNames: [] });

  await user.mutation(api.tabs.addMember, { slug: "trip", name: "Sam" });
  const added = (await seats(t)).find(s => s.name === "Sam")!;
  expect(added).toBeTruthy();

  await user.mutation(api.tabs.renameMember, { slug: "trip", memberId: added._id, name: "Samantha" });
  const renamed = (await seats(t)).find(s => s._id === added._id)!;
  // Patched in place - the seat id is stable, so expenses pointing at it
  // keep resolving.
  expect(renamed.name).toBe("Samantha");
  expect(renamed.inviteToken).toBe(added.inviteToken);

  await user.mutation(api.tabs.removeMember, { slug: "trip", memberId: added._id });
  expect((await seats(t)).some(s => s._id === added._id)).toBe(false);
});

test("a duplicate name is refused against the rows", async () => {
  const { user } = await setup();
  await user.mutation(api.tabs.create, { slug: "trip", name: "Trip", memberNames: ["Sam"] });
  await expect(user.mutation(api.tabs.addMember, { slug: "trip", name: " sam " }))
    .rejects.toThrow("already in this tab");
});

test("claiming an invite patches the seat rather than replacing it", async () => {
  const { t, user } = await setup();
  await user.mutation(api.tabs.create, { slug: "trip", name: "Trip", memberNames: ["Sam"] });
  const samId = await t.run(ctx => ctx.db.insert("users", { name: "Sam" }));
  const sam = t.withIdentity({ subject: `${samId}|session` });

  const seat = (await seats(t)).find(s => s.name === "Sam")!;
  await sam.mutation(api.tabs.claimMember, { slug: "trip", token: seat.inviteToken });

  const after = (await seats(t)).find(s => s._id === seat._id)!;
  expect(after.userId).toBe(samId);
  expect(after._id).toBe(seat._id);
  // The claimed seat now lists the tab for its occupant.
  expect((await sam.query(api.tabs.list)).map(row => row.slug)).toEqual(["trip"]);
});

test("members added while creating an expense become seats too", async () => {
  const { t, user } = await setup();
  await user.mutation(api.tabs.create, { slug: "trip", name: "Trip", memberNames: [] });

  await user.mutation(api.tabs.createExpense, {
    tabSlug: "trip", expenseSlug: "dinner", state,
    memberMapping: [{ personId: "person-1", newMemberName: "Guest" }],
  });
  expect((await seats(t)).map(s => s.name)).toEqual(["Alex", "Guest"]);

  await user.mutation(api.tabs.addMember, { slug: "trip", name: "Late Arrival" });
  expect((await seats(t)).map(s => s.name)).toEqual(["Alex", "Guest", "Late Arrival"]);

  // The expense references the seat by its row id.
  const expense = await t.run(ctx => ctx.db.query("expenses").first());
  const guest = (await seats(t)).find(s => s.name === "Guest")!;
  expect(expense!.items[0].splitWith).toEqual([guest._id]);
  expect(expense).not.toHaveProperty("tabMemberIds");
  expect(expense).not.toHaveProperty("people");
});

test("deleting a tab takes its seats with it", async () => {
  const { t, user } = await setup();
  await user.mutation(api.tabs.create, { slug: "trip", name: "Trip", memberNames: ["Sam"] });
  await user.mutation(api.tabs.create, { slug: "other", name: "Other", memberNames: [] });
  expect(await seats(t)).toHaveLength(3);

  await user.mutation(api.tabs.deleteTab, { slug: "trip" });

  // The surviving tab keeps its own seat; nothing is orphaned.
  expect((await seats(t)).map(s => s.name)).toEqual(["Alex"]);
});
