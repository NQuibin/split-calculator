/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { toExpenseStateArgs } from "../src/lib/expenseSync";

const modules = import.meta.glob("./**/*.ts");
const state = {
  name: "Dinner",
  mode: "simple" as const,
  date: "2026-09-07",
  currency: "USD",
  people: [{ id: "person-1", name: "Alex" }],
  payerId: "person-1",
  items: [
    {
      id: "total",
      name: "Dinner",
      cost: 30,
      splitWith: ["person-1"],
      discount: { mode: "amount" as const, value: 0 },
      tax: { mode: "amount" as const, value: 0 },
      tip: { mode: "amount" as const, value: 0 },
    },
  ],
};

/** Alex owns a "trip" tab holding one expense; Sam has an account but no part in it. */
async function setup() {
  const t = convexTest(schema, modules);
  const alexId = await t.run((ctx) => ctx.db.insert("users", { name: "Alex" }));
  const samId = await t.run((ctx) => ctx.db.insert("users", { name: "Sam" }));
  const alex = t.withIdentity({ subject: `${alexId}|session` });
  const sam = t.withIdentity({ subject: `${samId}|session` });

  await alex.mutation(api.tabs.create, { slug: "trip", name: "Trip", memberNames: ["Sam"] });
  const tab = (await alex.query(api.tabs.getBySlug, { slug: "trip" }))!;
  await alex.mutation(api.tabs.createExpense, {
    tabSlug: "trip",
    expenseSlug: "dinner",
    state,
    memberMapping: [{ personId: "person-1", memberId: tab.members[0].id }],
  });
  return { t, alex, sam, tab };
}

test("an outsider cannot read a tab, its expenses, or its balances", async () => {
  const { sam } = await setup();
  await expect(sam.query(api.tabs.getBySlug, { slug: "trip" })).rejects.toThrow("Not authorized");
  await expect(sam.query(api.tabs.expensesForTab, { slug: "trip" })).rejects.toThrow(
    "Not authorized",
  );
  await expect(sam.query(api.tabs.breakdown, { slug: "trip" })).rejects.toThrow("Not authorized");
  await expect(sam.query(api.tabs.getInviteLinks, { slug: "trip" })).rejects.toThrow(
    "Not authorized",
  );
  await expect(sam.mutation(api.tabs.rename, { slug: "trip", name: "Hijacked" })).rejects.toThrow(
    "Not authorized",
  );
  await expect(
    sam.mutation(api.tabs.createExpense, {
      tabSlug: "trip",
      expenseSlug: "outsider-dinner",
      state,
      memberMapping: [],
    }),
  ).rejects.toThrow("Not authorized");
});

test("a signed-out visitor cannot read a tab", async () => {
  const { t } = await setup();
  await expect(t.query(api.tabs.getBySlug, { slug: "trip" })).rejects.toThrow("Not signed in");
  await expect(t.query(api.tabs.expensesForTab, { slug: "trip" })).rejects.toThrow("Not signed in");
  await expect(t.query(api.tabs.breakdown, { slug: "trip" })).rejects.toThrow("Not signed in");
});

test("a tab that doesn't exist reads as missing, not forbidden", async () => {
  const { sam } = await setup();
  expect(await sam.query(api.tabs.getBySlug, { slug: "nope" })).toBeNull();
  expect(await sam.query(api.tabs.breakdown, { slug: "nope" })).toBeNull();
  expect(await sam.query(api.tabs.expensesForTab, { slug: "nope" })).toEqual([]);
});

test("an invite token opens the tab's name and roster, but nothing else", async () => {
  const { t, sam, tab } = await setup();
  const links = await t.run(async (ctx) => {
    const seats = await ctx.db.query("tabMembers").collect();
    return seats.filter((s) => !s.userId).map((s) => s.inviteToken);
  });
  const token = links[0];

  const invited = await t.query(api.tabs.getBySlug, { slug: "trip", token });
  expect(invited?.name).toBe("Trip");
  expect(invited?.members).toHaveLength(tab.members.length);

  // The token is not a key to the tab's contents.
  await expect(sam.query(api.tabs.expensesForTab, { slug: "trip" })).rejects.toThrow(
    "Not authorized",
  );
  await expect(t.query(api.tabs.getBySlug, { slug: "trip", token: "made-up" })).rejects.toThrow(
    "Not signed in",
  );
});

test("claiming an invite is what grants access", async () => {
  const { t, sam } = await setup();
  const token = await t.run(async (ctx) => {
    const seats = await ctx.db.query("tabMembers").collect();
    return seats.find((s) => !s.userId)!.inviteToken;
  });

  await sam.mutation(api.tabs.claimMember, { slug: "trip", token });

  expect((await sam.query(api.tabs.getBySlug, { slug: "trip" }))?.name).toBe("Trip");
  expect(await sam.query(api.tabs.expensesForTab, { slug: "trip" })).toHaveLength(1);
  expect(await sam.query(api.tabs.breakdown, { slug: "trip" })).not.toBeNull();
  const detail = await sam.query(api.tabs.getBySlug, { slug: "trip" });
  expect(detail?.isOwner).toBe(false);
  expect(detail?.ownerName).toBe("Alex");
  expect(await sam.query(api.tabs.getInviteLinks, { slug: "trip" })).toEqual([]);
  await sam.mutation(api.tabs.rename, { slug: "trip", name: "Shared trip" });
  await sam.mutation(api.tabs.setDefaultCurrency, { slug: "trip", currency: "CAD" });
  await sam.mutation(api.tabs.addMember, { slug: "trip", name: "Jo" });
  const added = (await sam.query(api.tabs.getInviteLinks, { slug: "trip" }))[0];
  expect(added.name).toBe("Jo");
  await sam.mutation(api.tabs.renameMember, {
    slug: "trip",
    memberId: added.memberId,
    name: "Jojo",
  });
  await sam.mutation(api.tabs.removeMember, { slug: "trip", memberId: added.memberId });
  await expect(sam.mutation(api.tabs.deleteTab, { slug: "trip" })).rejects.toThrow(
    "Not authorized",
  );
});

test("someone else's expense is forbidden, not invisible", async () => {
  const { t, sam } = await setup();
  await expect(sam.query(api.expenses.get, { slug: "dinner" })).rejects.toThrow("Not authorized");
  await expect(sam.mutation(api.expenses.save, { slug: "dinner", state })).rejects.toThrow(
    "Not authorized",
  );
  await expect(sam.mutation(api.expenses.remove, { slug: "dinner" })).rejects.toThrow(
    "Not authorized",
  );
  await expect(t.query(api.expenses.get, { slug: "dinner" })).rejects.toThrow("Not signed in");
  // An unused slug is still just missing.
  expect(await sam.query(api.expenses.get, { slug: "nope" })).toBeNull();
});

test("a tab member can create, read, edit, and delete shared expenses", async () => {
  const { t, sam } = await setup();
  const token = await t.run(async (ctx) => {
    const seats = await ctx.db.query("tabMembers").collect();
    return seats.find((s) => !s.userId)!.inviteToken;
  });
  await sam.mutation(api.tabs.claimMember, { slug: "trip", token });

  const tab = (await sam.query(api.tabs.getBySlug, { slug: "trip" }))!;
  expect(await sam.query(api.expenses.get, { slug: "dinner" })).toMatchObject({
    name: "Dinner",
    tab: { slug: "trip" },
  });
  const edited = toExpenseStateArgs((await sam.query(api.expenses.get, { slug: "dinner" }))!);
  edited.name = "Shared edit";
  await sam.mutation(api.expenses.save, { slug: "dinner", state: edited });
  expect((await sam.query(api.expenses.get, { slug: "dinner" }))?.name).toBe("Shared edit");
  await sam.mutation(api.tabs.setDefaultCurrency, { slug: "trip", currency: "CAD" });
  await sam.mutation(api.tabs.setExpenseExchangeRate, {
    slug: "trip",
    expenseSlug: "dinner",
    from: "USD",
    to: "CAD",
    rate: 1.4,
  });
  await sam.mutation(api.tabs.createExpense, {
    tabSlug: "trip",
    expenseSlug: "sam-dinner",
    state,
    memberMapping: [{ personId: "person-1", memberId: tab.members[0].id }],
  });
  expect(await sam.query(api.expenses.get, { slug: "sam-dinner" })).toMatchObject({
    name: "Dinner",
    tab: { slug: "trip" },
  });
  const ownTabExpense = toExpenseStateArgs(
    (await sam.query(api.expenses.get, { slug: "sam-dinner" }))!,
  );
  ownTabExpense.name = "Updated by Sam";
  await sam.mutation(api.expenses.save, { slug: "sam-dinner", state: ownTabExpense });
  expect((await sam.query(api.expenses.get, { slug: "sam-dinner" }))?.name).toBe("Updated by Sam");
  await sam.mutation(api.expenses.remove, { slug: "sam-dinner" });
  expect(await sam.query(api.expenses.get, { slug: "sam-dinner" })).toBeNull();
});
