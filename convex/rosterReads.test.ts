/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

// Phase 3 moved every roster read onto `tabMembers`. The array is still
// written, so a green suite proves nothing on its own - a read could be
// served from either. These tests make the two disagree and assert the rows
// win, which is exactly the invariant phase 4 relies on before it stops
// writing the array at all.

const modules = import.meta.glob("./**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  const userId = await t.run(ctx => ctx.db.insert("users", { name: "Alex" }));
  const user = t.withIdentity({ subject: `${userId}|session` });
  await user.mutation(api.tabs.create, { slug: "trip", name: "Trip", memberNames: ["Sam"] });
  return { t, userId, user };
}

/** Rewrites `tabs.members[]` to something the rows disagree with. */
async function corruptArray(t: Awaited<ReturnType<typeof setup>>["t"]) {
  await t.run(async (ctx) => {
    const tab = (await ctx.db.query("tabs").first())!;
    await ctx.db.patch(tab._id, {
      members: [
        { id: "ghost-seat", name: "Ghost", inviteToken: "ghost-token" },
        ...tab.members.map(m => ({ ...m, name: `STALE ${m.name}` })),
      ],
    });
  });
}

test("the roster comes from the rows, not the array", async () => {
  const { t, user } = await setup();
  await corruptArray(t);

  const tab = (await user.query(api.tabs.getBySlug, { slug: "trip" }))!;
  expect(tab.members.map(m => m.name).sort()).toEqual(["Alex", "Sam"]);
  expect(tab.members.some(m => m.name.startsWith("STALE"))).toBe(false);
  expect(tab.members.some(m => m.name === "Ghost")).toBe(false);
});

test("member counts, breakdowns and invite links all read the rows", async () => {
  const { t, user } = await setup();
  await corruptArray(t);

  expect((await user.query(api.tabs.list))[0].memberCount).toBe(2);

  const summary = (await user.query(api.tabs.listWithSummary))[0];
  expect(summary.memberCount).toBe(2);
  expect(summary.members.map(m => m.name).sort()).toEqual(["Alex", "Sam"]);

  const breakdown = await user.query(api.tabs.breakdown, { slug: "trip" });
  expect(breakdown!.currencies[0].members.map(m => m.name).sort()).toEqual(["Alex", "Sam"]);

  // The ghost seat's token is in the array but has no row, so it is not
  // offered as an invite - and the real unclaimed seat still is.
  const invites = await user.query(api.tabs.getInviteLinks, { slug: "trip" });
  expect(invites.map(i => i.name)).toEqual(["Sam"]);
  expect(invites.some(i => i.token === "ghost-token")).toBe(false);
});

test("a token only opens the tab if a row actually holds it", async () => {
  const { t } = await setup();
  await corruptArray(t);

  // "ghost-token" exists only in the stale array.
  await expect(t.query(api.tabs.getBySlug, { slug: "trip", token: "ghost-token" }))
    .rejects.toThrow("Not signed in");

  const realToken = await t.run(async ctx =>
    (await ctx.db.query("tabMembers").collect()).find(s => s.name === "Sam")!.inviteToken);
  const invited = await t.query(api.tabs.getBySlug, { slug: "trip", token: realToken });
  expect(invited!.name).toBe("Trip");
});

test("access and My Tabs follow the seat rows, not tabMemberships", async () => {
  const { t, user } = await setup();
  const samId = await t.run(ctx => ctx.db.insert("users", { name: "Sam" }));
  const sam = t.withIdentity({ subject: `${samId}|session` });
  const token = await t.run(async ctx =>
    (await ctx.db.query("tabMembers").collect()).find(s => s.name === "Sam")!.inviteToken);
  await sam.mutation(api.tabs.claimMember, { slug: "trip", token });

  // Deleting every membership row changes nothing - that table is written but
  // no longer read, which is what lets phase 5 drop it.
  await t.run(async (ctx) => {
    for (const row of await ctx.db.query("tabMemberships").collect()) await ctx.db.delete(row._id);
  });
  expect((await sam.query(api.tabs.list)).map(t => t.slug)).toEqual(["trip"]);
  expect((await sam.query(api.tabs.getBySlug, { slug: "trip" }))!.name).toBe("Trip");

  // And a membership row on its own grants nothing.
  const malloryId = await t.run(ctx => ctx.db.insert("users", { name: "Mallory" }));
  await t.run(async (ctx) => {
    const tab = (await ctx.db.query("tabs").first())!;
    await ctx.db.insert("tabMemberships", { userId: malloryId, tabId: tab._id });
  });
  const mallory = t.withIdentity({ subject: `${malloryId}|session` });
  expect(await mallory.query(api.tabs.list)).toEqual([]);
  await expect(mallory.query(api.tabs.getBySlug, { slug: "trip" })).rejects.toThrow("Not authorized");

  // The owner still finds their own tab without a membership row anywhere.
  expect((await user.query(api.tabs.list)).map(t => t.slug)).toEqual(["trip"]);
});
