/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

// `tabMembers` is the only roster there is. These tests change the rows out
// from under the read paths - directly, not through a mutation - and assert
// every read follows, which is what the retired array used to be checked
// against before it was dropped.

const modules = import.meta.glob("./**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert("users", { name: "Alex" }));
  const user = t.withIdentity({ subject: `${userId}|session` });
  await user.mutation(api.tabs.create, { slug: "trip", name: "Trip", memberNames: ["Sam"] });
  return { t, userId, user };
}

test("every read follows the rows", async () => {
  const { t, user } = await setup();

  await t.run(async (ctx) => {
    const sam = (await ctx.db.query("tabMembers").collect()).find((s) => s.name === "Sam")!;
    await ctx.db.patch(sam._id, { name: "Samantha" });
  });

  const tab = (await user.query(api.tabs.getBySlug, { slug: "trip" }))!;
  expect(tab.members.map((m) => m.name)).toEqual(["Alex", "Samantha"]);

  const summary = (await user.query(api.tabs.listWithSummary))[0];
  expect(summary.memberCount).toBe(2);
  expect(summary.members.map((m) => m.name)).toEqual(["Alex", "Samantha"]);

  const breakdown = await user.query(api.tabs.breakdown, { slug: "trip" });
  expect(breakdown!.currencies[0].members.map((m) => m.name).sort()).toEqual(["Alex", "Samantha"]);

  expect((await user.query(api.tabs.getInviteLinks, { slug: "trip" })).map((i) => i.name)).toEqual([
    "Samantha",
  ]);

  // Deleting a row removes the member from every read.
  await t.run(async (ctx) => {
    const sam = (await ctx.db.query("tabMembers").collect()).find((s) => s.name === "Samantha")!;
    await ctx.db.delete(sam._id);
  });
  expect((await user.query(api.tabs.list))[0].memberCount).toBe(1);
  expect(
    (await user.query(api.tabs.getBySlug, { slug: "trip" }))!.members.map((m) => m.name),
  ).toEqual(["Alex"]);
});

test("a token only opens the tab if a row holds it", async () => {
  const { t } = await setup();

  await expect(t.query(api.tabs.getBySlug, { slug: "trip", token: "made-up" })).rejects.toThrow(
    "Not signed in",
  );

  const realToken = await t.run(
    async (ctx) =>
      (await ctx.db.query("tabMembers").collect()).find((s) => s.name === "Sam")!.inviteToken,
  );
  expect((await t.query(api.tabs.getBySlug, { slug: "trip", token: realToken }))!.name).toBe(
    "Trip",
  );

  // A token stops working once its seat is gone.
  await t.run(async (ctx) => {
    const sam = (await ctx.db.query("tabMembers").collect()).find((s) => s.name === "Sam")!;
    await ctx.db.delete(sam._id);
  });
  await expect(t.query(api.tabs.getBySlug, { slug: "trip", token: realToken })).rejects.toThrow(
    "Not signed in",
  );
});

test("My Tabs and access both come from holding a seat", async () => {
  const { t, user } = await setup();

  // The owner finds their own tab through the seat `create` gave them.
  expect((await user.query(api.tabs.list)).map((row) => row.slug)).toEqual(["trip"]);

  const samId = await t.run((ctx) => ctx.db.insert("users", { name: "Sam" }));
  const sam = t.withIdentity({ subject: `${samId}|session` });
  expect(await sam.query(api.tabs.list)).toEqual([]);
  await expect(sam.query(api.tabs.getBySlug, { slug: "trip" })).rejects.toThrow("Not authorized");

  const token = await t.run(
    async (ctx) =>
      (await ctx.db.query("tabMembers").collect()).find((s) => s.name === "Sam")!.inviteToken,
  );
  await sam.mutation(api.tabs.claimMember, { slug: "trip", token });

  expect((await sam.query(api.tabs.list)).map((row) => row.slug)).toEqual(["trip"]);
  expect((await sam.query(api.tabs.getBySlug, { slug: "trip" }))!.name).toBe("Trip");

  // Losing the seat loses the access with it.
  const seatId = (await t.run((ctx) => ctx.db.query("tabMembers").collect())).find(
    (s) => s.userId === samId,
  )!._id;
  await user.mutation(api.tabs.removeMember, { slug: "trip", memberId: seatId });
  expect(await sam.query(api.tabs.list)).toEqual([]);
  await expect(sam.query(api.tabs.getBySlug, { slug: "trip" })).rejects.toThrow("Not authorized");
});
