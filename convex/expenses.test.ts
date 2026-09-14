/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const zero = { mode: "amount" as const, value: 0 };
const TODAY = "2026-09-12";
beforeEach(() => vi.useFakeTimers({ now: new Date(`${TODAY}T12:00:00Z`), toFake: ["Date"] }));
afterEach(() => vi.useRealTimers());

async function setup() {
  const t = convexTest(schema, modules);
  const ownerId = await t.run((ctx) => ctx.db.insert("users", { name: "Alex" }));
  const owner = t.withIdentity({ subject: `${ownerId}|session` });
  await owner.mutation(api.tabs.create, {
    slug: "trip",
    name: "Trip",
    memberNames: ["Bea", "Cam"],
  });
  const tab = (await owner.query(api.tabs.getBySlug, { slug: "trip" }))!;
  return { owner, members: tab.members };
}

test("the directory only counts people an expense's split actually owes or pays back", async () => {
  // Mirrors "Hmmm": Cam is a tab member and was added to this expense's
  // people, but the one item was only ever split between Alex and Bea - Cam
  // never ends up with a nonzero share, so the directory shouldn't list them.
  const { owner, members } = await setup();
  await owner.mutation(api.tabs.createExpense, {
    tabSlug: "trip",
    expenseSlug: "hmmm",
    state: {
      name: "Hmmm",
      mode: "simple",
      date: TODAY,
      currency: "USD",
      payerId: "b",
      people: [
        { id: "a", name: "Alex" },
        { id: "b", name: "Bea" },
        { id: "c", name: "Cam" },
      ],
      items: [
        {
          id: "total",
          name: "Hmmm",
          cost: 20,
          splitWith: ["a", "b"],
          discount: zero,
          tax: zero,
          tip: zero,
        },
      ],
    },
    memberMapping: [
      { personId: "a", memberId: members[0].id },
      { personId: "b", memberId: members[1].id },
      { personId: "c", memberId: members[2].id },
    ],
  });

  const rows = await owner.query(api.expenses.directory, {});
  const row = rows.find((r) => r.name === "Hmmm");
  expect(row?.people.map((p) => p.name).sort()).toEqual(["Alex", "Bea"]);
});
