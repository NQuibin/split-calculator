/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("a valid share token exposes an anonymous read-only breakdown for only its tab", async () => {
  const t = convexTest(schema, modules);
  const ownerId = await t.run((ctx) => ctx.db.insert("users", { name: "Alex" }));
  const owner = t.withIdentity({ subject: `${ownerId}|session` });
  await owner.mutation(api.tabs.create, { slug: "trip", name: "Trip", memberNames: ["Sam"] });
  await owner.mutation(api.tabs.create, { slug: "other", name: "Other", memberNames: [] });

  const trip = (await owner.query(api.tabs.getBySlug, { slug: "trip" }))!;
  const alex = trip.members[0].id;
  const sam = trip.members[1].id;
  await owner.mutation(api.tabs.createExpense, {
    tabSlug: "trip",
    expenseSlug: "dinner",
    state: {
      name: "Dinner",
      mode: "itemized",
      date: "2026-10-03",
      currency: "USD",
      payerId: alex,
      people: [
        { id: alex, name: "Alex" },
        { id: sam, name: "Sam" },
      ],
      items: [
        {
          id: "item",
          name: "Dinner",
          cost: 20,
          splitWith: [alex, sam],
          discount: { mode: "amount", value: 0 },
          tax: { mode: "amount", value: 0 },
          tip: { mode: "amount", value: 0 },
        },
      ],
    },
    memberMapping: [
      { personId: alex, memberId: alex },
      { personId: sam, memberId: sam },
    ],
  });
  await owner.mutation(api.settlements.record, {
    slug: "trip",
    asOfDate: "2026-10-03",
    fromMemberId: sam,
    toMemberId: alex,
    amount: 5,
    currency: "USD",
    date: "2026-10-03",
    requestId: "payment-1",
  });
  await owner.mutation(api.tabs.createExpense, {
    tabSlug: "trip",
    expenseSlug: "future-dinner",
    state: {
      name: "Future dinner",
      mode: "simple",
      date: "2026-10-10",
      currency: "USD",
      payerId: alex,
      people: [
        { id: alex, name: "Alex" },
        { id: sam, name: "Sam" },
      ],
      items: [
        {
          id: "item",
          name: "Future dinner",
          cost: 10,
          splitWith: [alex, sam],
          discount: { mode: "amount", value: 0 },
          tax: { mode: "amount", value: 0 },
          tip: { mode: "amount", value: 0 },
        },
      ],
    },
    memberMapping: [
      { personId: alex, memberId: alex },
      { personId: sam, memberId: sam },
    ],
  });

  const shareToken = await owner.mutation(api.tabs.getOrCreateShareToken, { slug: "trip" });
  const emptyToken = await owner.mutation(api.tabs.getOrCreateShareToken, { slug: "other" });
  const emptyShared = await t.query(api.settlements.publicShare, {
    slug: "other",
    shareToken: emptyToken,
    asOfDate: "2026-10-03",
  });
  expect(emptyShared?.currencies).toHaveLength(1);
  expect(emptyShared?.currencies[0]?.members).toHaveLength(1);
  const shared = await t.query(api.settlements.publicShare, {
    slug: "trip",
    shareToken,
    asOfDate: "2026-10-03",
  });
  expect(shared?.tab).toEqual({ slug: "trip", name: "Trip" });
  const members = shared?.currencies[0]?.members ?? [];
  expect(
    members.find((member) => member.name === "Alex")?.expenses.find((e) => e.key === "dinner"),
  ).toMatchObject({
    name: "Dinner",
    date: "2026-10-03",
    amount: 20,
    paid: true,
    paidAmount: 20,
    shareAmount: 10,
    total: 20,
    items: [{ name: "Dinner", total: 20, share: 10 }],
  });
  expect(
    members.find((member) => member.name === "Sam")?.expenses.find((e) => e.key === "dinner"),
  ).toMatchObject({
    name: "Dinner",
    date: "2026-10-03",
    amount: 10,
    paid: false,
    paidAmount: 0,
    shareAmount: 10,
    total: 20,
    items: [{ name: "Dinner", total: 20, share: 10 }],
  });
  expect(shared?.currencies[0]?.settlements).toEqual([
    { from: members[1]?.key, to: members[0]?.key, amount: 10 },
  ]);
  expect(shared?.history).toMatchObject([
    {
      fromMemberId: sam,
      toMemberId: alex,
      from: "Sam",
      to: "Alex",
      amount: 5,
      currency: "USD",
    },
  ]);
  expect(shared).not.toHaveProperty("ownerId");
  expect(
    await t.query(api.settlements.publicShare, {
      slug: "trip",
      shareToken: "invalid",
      asOfDate: "2026-10-03",
    }),
  ).toBeNull();
  expect(shared?.tab.name).not.toBe("Other");
});
