/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

// Phase 1 of the roster migration: `tabs.members[]` stays the source of
// truth, and `tabMembers` rows must track it through every write path. These
// tests assert that mirror rather than any new behaviour - reads are still
// served entirely from the array, so nothing user-facing changes here.

const modules = import.meta.glob("./**/*.ts");
const state = {
  stage: "receipt" as const, name: "Dinner", namePeople: true, mode: "simple" as const,
  date: "2026-09-07", currency: "USD", people: [{ id: "person-1", name: "Alex" }],
  items: [{ id: "total", name: "Dinner", cost: 30, splitWith: ["person-1"],
    discount: { mode: "amount" as const, value: 0 }, tax: { mode: "amount" as const, value: 0 }, tip: { mode: "amount" as const, value: 0 } }],
  contributions: [],
};

async function setup() {
  const t = convexTest(schema, modules);
  const userId = await t.run(ctx => ctx.db.insert("users", { name: "Alex" }));
  return { t, userId, user: t.withIdentity({ subject: `${userId}|session` }) };
}

/** Inferred from `setup` rather than instantiated by hand - convexTest is generic over the schema, and naming that type here buys nothing. */
type TestConvex = Awaited<ReturnType<typeof setup>>["t"];

/** Every seat row, keyed by its id - which is the seat id the roster holds. */
async function rows(t: TestConvex) {
  const docs = await t.run(ctx => ctx.db.query("tabMembers").collect());
  return new Map(docs.map(r => [r._id as string, r]));
}

/** The array and the rows agree, for every tab in the database. */
async function expectMirrored(t: TestConvex) {
  const tabs = await t.run(ctx => ctx.db.query("tabs").collect());
  const byMemberId = await rows(t);
  let seats = 0;
  for (const tab of tabs) {
    for (const member of tab.members) {
      seats += 1;
      const row = byMemberId.get(member.id);
      expect(row, `no row for seat ${member.name}`).toBeTruthy();
      expect(row!.tabId).toBe(tab._id);
      expect(row!.name).toBe(member.name);
      expect(row!.inviteToken).toBe(member.inviteToken);
      expect(row!.userId).toBe(member.claimedByUserId);
    }
  }
  // No row survives that the arrays no longer list.
  expect(byMemberId.size).toBe(seats);
}

test("creating a tab mirrors every seat, and marks the creator's as claimed", async () => {
  const { t, user, userId } = await setup();
  await user.mutation(api.tabs.create, { slug: "trip", name: "Trip", memberNames: ["Sam", "Jo"] });

  await expectMirrored(t);
  const byMemberId = await rows(t);
  expect(byMemberId.size).toBe(3);

  const claimed = [...byMemberId.values()].filter(r => r.userId !== undefined);
  expect(claimed).toHaveLength(1);
  expect(claimed[0].userId).toBe(userId);
  expect(claimed[0].name).toBe("Alex");
  // Anonymous seats carry no userId at all, which is what `by_user` relies on.
  expect([...byMemberId.values()].filter(r => r.userId === undefined).map(r => r.name).sort())
    .toEqual(["Jo", "Sam"]);
});

test("adding, renaming and removing a member all reach the rows", async () => {
  const { t, user } = await setup();
  await user.mutation(api.tabs.create, { slug: "trip", name: "Trip", memberNames: [] });

  await user.mutation(api.tabs.addMember, { slug: "trip", name: "Sam" });
  await expectMirrored(t);
  const added = [...(await rows(t)).values()].find(r => r.name === "Sam")!;
  expect(added).toBeTruthy();

  await user.mutation(api.tabs.renameMember, { slug: "trip", memberId: added._id, name: "Samantha" });
  await expectMirrored(t);
  // Renaming patches the existing row - the seat id is the row id, so it is
  // stable and expenses pointing at it keep resolving.
  expect((await rows(t)).get(added._id)!.name).toBe("Samantha");

  await user.mutation(api.tabs.removeMember, { slug: "trip", memberId: added._id });
  await expectMirrored(t);
  expect((await rows(t)).has(added._id)).toBe(false);
});

test("claiming an invite sets userId on the existing row", async () => {
  const { t, user } = await setup();
  await user.mutation(api.tabs.create, { slug: "trip", name: "Trip", memberNames: ["Sam"] });
  const samId = await t.run(ctx => ctx.db.insert("users", { name: "Sam" }));
  const sam = t.withIdentity({ subject: `${samId}|session` });

  const seat = [...(await rows(t)).values()].find(r => r.name === "Sam")!;
  await sam.mutation(api.tabs.claimMember, { slug: "trip", token: seat.inviteToken });

  await expectMirrored(t);
  const after = (await rows(t)).get(seat._id)!;
  expect(after.userId).toBe(samId);
  // The row itself is the same document - claiming is a patch, not a move.
  expect(after._id).toBe(seat._id);
});

test("members added while creating an expense are mirrored too", async () => {
  const { t, user } = await setup();
  await user.mutation(api.tabs.create, { slug: "trip", name: "Trip", memberNames: [] });
  const tab = (await user.query(api.tabs.getBySlug, { slug: "trip" }))!;

  await user.mutation(api.tabs.createExpense, {
    tabSlug: "trip", expenseSlug: "dinner", state,
    memberMapping: [{ personId: "person-1", newMemberName: "Guest" }],
  });
  await expectMirrored(t);
  expect([...(await rows(t)).values()].map(r => r.name).sort()).toEqual(["Alex", "Guest"]);

  await user.mutation(api.tabs.addExpensePerson, { expenseSlug: "dinner", newMemberName: "Late Arrival" });
  await expectMirrored(t);
  expect([...(await rows(t)).values()].map(r => r.name).sort()).toEqual(["Alex", "Guest", "Late Arrival"]);
  expect(tab.members).toHaveLength(1); // the pre-expense snapshot, unchanged
});

test("deleting a tab takes its rows with it", async () => {
  const { t, user } = await setup();
  await user.mutation(api.tabs.create, { slug: "trip", name: "Trip", memberNames: ["Sam"] });
  await user.mutation(api.tabs.create, { slug: "other", name: "Other", memberNames: [] });
  expect((await rows(t)).size).toBe(3);

  await user.mutation(api.tabs.deleteTab, { slug: "trip" });

  // The surviving tab keeps its own row; nothing is orphaned.
  await expectMirrored(t);
  expect([...(await rows(t)).values()].map(r => r.name)).toEqual(["Alex"]);
});
