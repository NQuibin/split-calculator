/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { avatarColorIndex } from "../src/lib/avatarColors";

const modules = import.meta.glob("./**/*.ts");

const state = {
  name: "Dinner", mode: "simple" as const,
  date: "2026-09-07", currency: "USD", people: [{ id: "person-1", name: "Nikki Q" }],
  items: [{ id: "total", name: "Dinner", cost: 30, splitWith: ["person-1"],
    discount: { mode: "amount" as const, value: 0 }, tax: { mode: "amount" as const, value: 0 }, tip: { mode: "amount" as const, value: 0 } }],
  contributions: [],
};

/**
 * A claimed member used to render one colour as the expense creator (keyed on
 * their account id) and another in the same row's participant list (keyed on
 * their seat id). Everything a tab renders must agree on the seat id.
 */
test("a claimed member gets one avatar colour across a tab", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run(ctx => ctx.db.insert("users", { name: "Nikki Q" }));
  const user = t.withIdentity({ subject: `${userId}|session` });

  await user.mutation(api.tabs.create, { slug: "trip", name: "Trip", memberNames: ["Pat"] });
  const tab = await user.query(api.tabs.getBySlug, { slug: "trip" });
  // The tab's creator holds a claimed seat; "Pat" is an anonymous one.
  const claimed = tab!.members.find(member => member.claimed)!;
  const anonymous = tab!.members.find(member => !member.claimed)!;
  expect(claimed.resolvedId).not.toBe(claimed.id); // account id, not the seat
  expect(anonymous.resolvedId).toBe(anonymous.id);

  await user.mutation(api.tabs.createExpense, {
    tabSlug: "trip", expenseSlug: "dinner", state,
    memberMapping: [{ personId: "person-1", memberId: claimed.id }],
  });

  const [expense] = await user.query(api.tabs.expensesForTab, { slug: "trip" });
  const participant = expense.people.find(person => person.id === claimed.id)!;

  // The creator is handed back their seat, so the two columns in the expense
  // row agree - and both agree with the roster.
  expect(expense.createdBy.id).toBe(claimed.id);
  expect(avatarColorIndex(expense.createdBy.id)).toBe(avatarColorIndex(participant.id));
  expect(avatarColorIndex(expense.createdBy.id)).toBe(avatarColorIndex(claimed.id));

  // Keying on resolvedId is what produced the mismatch in the first place.
  expect(avatarColorIndex(claimed.resolvedId)).not.toBe(avatarColorIndex(claimed.id));

  // Anonymous members were already seat-keyed and must stay that way.
  const anonParticipant = expense.people.find(person => person.id === anonymous.id)!;
  expect(avatarColorIndex(anonParticipant.id)).toBe(avatarColorIndex(anonymous.id));
});
