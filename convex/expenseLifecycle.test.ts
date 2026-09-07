/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

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

test("signed-in users cannot create a standalone expense", async () => {
  const { user } = await setup();
  await expect(user.mutation(api.expenses.save, { slug: "standalone", state })).rejects.toThrow("Choose a tab");
  expect(await user.query(api.expenses.list)).toEqual([]);
});

test("guests cannot save to the backend", async () => {
  const { t } = await setup();
  await expect(t.mutation(api.expenses.save, { slug: "guest", state })).rejects.toThrow("Not signed in");
});

test("creating in a tab and editing preserves membership even with no items", async () => {
  const { user } = await setup();
  await user.mutation(api.tabs.create, { slug: "trip", name: "Trip", memberNames: [] });
  const tab = await user.query(api.tabs.getBySlug, { slug: "trip" });
  await user.mutation(api.tabs.createExpense, {
    tabSlug: "trip", expenseSlug: "dinner", state,
    memberMapping: [{ personId: "person-1", memberId: tab!.members[0].id }],
  });
  const saved = await user.query(api.expenses.get, { slug: "dinner" });
  expect(saved?.tab?.slug).toBe("trip");
  await user.mutation(api.expenses.save, { slug: "dinner", state: { ...state, items: [] } });
  const empty = await user.query(api.expenses.get, { slug: "dinner" });
  expect(empty?.items).toEqual([]);
  expect(empty?.tab?.slug).toBe("trip");
  await user.mutation(api.expenses.save, { slug: "dinner", state });
  expect((await user.query(api.expenses.get, { slug: "dinner" }))?.items).toHaveLength(1);
});

test("an existing expense cannot be added to a tab", async () => {
  const { t, user, userId } = await setup();
  await t.run(ctx => ctx.db.insert("expenses", { ...state, slug: "old", userId, updatedAt: 0 }));
  await user.mutation(api.tabs.create, { slug: "trip", name: "Trip", memberNames: [] });
  await expect(user.mutation(api.tabs.createExpense, { tabSlug: "trip", expenseSlug: "old", state, memberMapping: [] })).rejects.toThrow("existing expense");
});

test("another user's tab cannot receive a new expense", async () => {
  const { t, user } = await setup();
  await user.mutation(api.tabs.create, { slug: "trip", name: "Trip", memberNames: [] });
  const otherId = await t.run(ctx => ctx.db.insert("users", { name: "Other" }));
  const other = t.withIdentity({ subject: `${otherId}|session` });
  await expect(other.mutation(api.tabs.createExpense, { tabSlug: "trip", expenseSlug: "dinner", state, memberMapping: [] })).rejects.toThrow("Not authorized");
  expect(await other.query(api.expenses.list)).toEqual([]);
});

test("a tab's expenses stay in creation order, newest first", async () => {
  const { user } = await setup();
  await user.mutation(api.tabs.create, { slug: "trip", name: "Trip", memberNames: [] });
  const tab = (await user.query(api.tabs.getBySlug, { slug: "trip" }))!;
  const mapping = [{ personId: "person-1", memberId: tab.members[0].id }];

  for (const name of ["first", "second", "third"]) {
    await user.mutation(api.tabs.createExpense, {
      tabSlug: "trip", expenseSlug: name, state: { ...state, name }, memberMapping: mapping,
    });
  }

  // Touching the oldest expense must not move it in the tab's own list -
  // that order is by creation, so it stays put for everyone looking at it.
  await user.mutation(api.expenses.save, { slug: "first", state: { ...state, name: "first", date: "2026-01-01" } });

  const inTab = await user.query(api.tabs.expensesForTab, { slug: "trip" });
  expect(inTab.map(e => e.name)).toEqual(["third", "second", "first"]);
  expect(inTab.map(e => e.createdAt)).toEqual([...inTab.map(e => e.createdAt)].sort((a, b) => b - a));
});

test("the expenses directory orders by last update, newest first", async () => {
  const { t, user } = await setup();
  await user.mutation(api.tabs.create, { slug: "trip", name: "Trip", memberNames: [] });
  const tab = (await user.query(api.tabs.getBySlug, { slug: "trip" }))!;
  const mapping = [{ personId: "person-1", memberId: tab.members[0].id }];

  for (const name of ["first", "second", "third"]) {
    await user.mutation(api.tabs.createExpense, {
      tabSlug: "trip", expenseSlug: name, state: { ...state, name }, memberMapping: mapping,
    });
  }

  // Stamped rather than saved through the mutation: three saves can land in
  // the same millisecond, which would make the assertion depend on the clock.
  const stamps: Record<string, number> = { first: 300, second: 100, third: 200 };
  await t.run(async ctx => {
    for (const doc of await ctx.db.query("expenses").collect()) {
      await ctx.db.patch(doc._id, { updatedAt: stamps[doc.slug] });
    }
  });

  const directory = await user.query(api.expenses.directory);
  expect(directory.map(row => row.name)).toEqual(["first", "third", "second"]);
});

test("deleting a tab deletes its expenses and their receipts", async () => {
  const { t, user, userId } = await setup();
  await user.mutation(api.tabs.create, { slug: "trip", name: "Trip", memberNames: [] });
  const tab = (await user.query(api.tabs.getBySlug, { slug: "trip" }))!;
  await user.mutation(api.tabs.createExpense, {
    tabSlug: "trip", expenseSlug: "dinner", state,
    memberMapping: [{ personId: "person-1", memberId: tab.members[0].id }],
  });

  // Attached directly: convex-test's storage.store records no contentType,
  // so assertValidImage (rightly) refuses the file through the normal path.
  const storageId = await t.run(async ctx => {
    const id = await ctx.storage.store(new Blob(["receipt"]));
    const expense = (await ctx.db.query("expenses").first())!;
    await ctx.db.patch(expense._id, { image: { storageId: id, name: "receipt.png", type: "image/png" } });
    return id;
  });

  await user.mutation(api.tabs.deleteTab, { slug: "trip" });

  expect(await user.query(api.expenses.list)).toEqual([]);
  expect(await user.query(api.expenses.get, { slug: "dinner" })).toBeNull();
  expect(await t.run(ctx => ctx.db.query("expenses").collect())).toEqual([]);
  // The receipt goes with the expense - nothing points at the file any more.
  expect(await t.run(ctx => ctx.db.system.get("_storage", storageId))).toBeNull();
  // And the owner's membership row is cleaned up, as before.
  expect(await t.run(ctx => ctx.db.query("tabMemberships").withIndex("by_user", q => q.eq("userId", userId)).collect())).toEqual([]);
});
