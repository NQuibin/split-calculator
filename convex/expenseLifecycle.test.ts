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
