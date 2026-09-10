/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { toExpenseStateArgs } from "../src/lib/expenseSync";

const modules = import.meta.glob("./**/*.ts");
const state = {
  stage: "receipt" as const, name: "Dinner", mode: "simple" as const,
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
  await user.mutation(api.expenses.save, { slug: "dinner", state: toExpenseStateArgs(saved!) });
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

test("a tab sorts by descending date, then descending creation time", async () => {
  const { user } = await setup();
  await user.mutation(api.tabs.create, { slug: "trip", name: "Trip", memberNames: [] });
  const tab = (await user.query(api.tabs.getBySlug, { slug: "trip" }))!;
  const mapping = [{ personId: "person-1", memberId: tab.members[0].id }];

  for (const name of ["first", "second", "third"]) {
    await user.mutation(api.tabs.createExpense, {
      tabSlug: "trip", expenseSlug: name, state: { ...state, name }, memberMapping: mapping,
    });
  }

  // An older-created expense with a later date must move ahead of newer rows.
  await user.mutation(api.expenses.save, { slug: "first", state: { ...toExpenseStateArgs((await user.query(api.expenses.get, { slug: "first" }))!), name: "first", date: "2026-12-01" } });

  const inTab = await user.query(api.tabs.expensesForTab, { slug: "trip" });
  expect(inTab.map(e => e.name)).toEqual(["first", "third", "second"]);
  expect(inTab[1].createdAt).toBeGreaterThan(inTab[2].createdAt);
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
  const { t, user } = await setup();
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
  // And the tab's seats go with it.
  expect(await t.run(ctx => ctx.db.query("tabMembers").collect())).toEqual([]);
});

test("new tab members are available on old expenses without changing selections or balances", async () => {
  const { t, user } = await setup();
  await user.mutation(api.tabs.create, { slug: "trip", name: "Trip", memberNames: [] });
  const tab = (await user.query(api.tabs.getBySlug, { slug: "trip" }))!;
  const owner = tab.members[0].id;
  await user.mutation(api.tabs.createExpense, {
    tabSlug: "trip", expenseSlug: "dinner", state,
    memberMapping: [{ personId: "person-1", memberId: owner }],
  });
  await user.mutation(api.tabs.addMember, { slug: "trip", name: "Sam" });
  const saved = (await user.query(api.expenses.get, { slug: "dinner" }))!;
  const sam = saved.people.find(p => p.name === "Sam")!;
  expect(sam).toBeDefined();
  expect(saved.items[0].splitWith).toEqual([owner]);
  const edited = toExpenseStateArgs(saved);
  edited.items[0].splitWith.push(sam.id);
  edited.contributions = [{ personId: sam.id, amount: { mode: "amount", value: 30 } }];
  await user.mutation(api.expenses.save, { slug: "dinner", state: edited });
  const raw = (await t.run(ctx => ctx.db.query("expenses").first()))!;
  expect(raw.people).toBeUndefined();
  expect(raw.tabMemberIds).toBeUndefined();
  expect(raw.items[0].splitWith).toEqual([owner, sam.id]);
  await expect(user.mutation(api.tabs.removeMember, { slug: "trip", memberId: sam.id })).rejects.toThrow("used by an expense");
  const samUserId = await t.run(ctx => ctx.db.insert("users", { name: "Samuel" }));
  const seat = (await t.run(ctx => ctx.db.query("tabMembers").collect())).find(s => s._id === sam.id)!;
  await t.withIdentity({ subject: `${samUserId}|session` }).mutation(api.tabs.claimMember, { slug: "trip", token: seat.inviteToken });
  const after = (await user.query(api.expenses.get, { slug: "dinner" }))!;
  expect(after.people.find(p => p.id === sam.id)?.name).toBe("Samuel");
  expect(after.items).toEqual(edited.items);
  expect(after.contributions).toEqual(edited.contributions);
  await user.mutation(api.tabs.create, { slug: "other", name: "Other", memberNames: [] });
  const foreign = (await user.query(api.tabs.getBySlug, { slug: "other" }))!.members[0].id;
  edited.items[0].splitWith = [foreign];
  await expect(user.mutation(api.expenses.save, { slug: "dinner", state: edited })).rejects.toThrow("must belong to this tab");
  edited.items[0].splitWith = [owner];
  edited.contributions[0].personId = foreign;
  await expect(user.mutation(api.expenses.save, { slug: "dinner", state: edited })).rejects.toThrow("must belong to this tab");
});

test("legacy user IDs translate to seat IDs and saving removes the old mapping", async () => {
  const { t, user, userId } = await setup();
  await user.mutation(api.tabs.create, { slug: "trip", name: "Trip", memberNames: [] });
  const tab = (await user.query(api.tabs.getBySlug, { slug: "trip" }))!;
  const tabDoc = (await t.run(ctx => ctx.db.query("tabs").first()))!;
  await t.run(ctx => ctx.db.insert("expenses", {
    ...state, slug: "legacy", userId, tabId: tabDoc._id, updatedAt: 0,
    people: [{ id: userId, name: "Old name" }],
    items: state.items.map(item => ({ ...item, splitWith: [userId] })),
    contributions: [{ personId: userId, amount: { mode: "amount", value: 30 } }],
    tabMemberIds: [{ personId: userId, memberId: tab.members[0].id }],
  }));
  const resolved = (await user.query(api.expenses.get, { slug: "legacy" }))!;
  expect(resolved.items[0].splitWith).toEqual([tab.members[0].id]);
  expect(resolved.contributions[0].personId).toBe(tab.members[0].id);
  await user.mutation(api.expenses.save, { slug: "legacy", state: toExpenseStateArgs(resolved) });
  const raw = (await t.run(ctx => ctx.db.query("expenses").first()))!;
  expect(raw.memberReferencesVersion).toBe(1);
  expect(raw.people).toBeUndefined();
  expect(raw.tabMemberIds).toBeUndefined();
});
