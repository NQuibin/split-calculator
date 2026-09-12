/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import component from "@convex-dev/migrations/test";
import { runToCompletion } from "@convex-dev/migrations";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { expect, test } from "vitest";
import { components, internal } from "./_generated/api";
import schema from "./schema";

// Rehearse against the pre-backfill shape even after the live schema is tightened.
const legacySchema = defineSchema({ ...schema.tables, expenses: defineTable({
  ...schema.tables.expenses.validator.fields, payerId: v.optional(v.id("tabMembers")),
}) });
const modules = import.meta.glob("./**/*.ts");

test("backfill uses creator identity, preserves explicit payers and expense data, and is repeatable", async () => {
  const t = convexTest(legacySchema, modules);
  component.register(t);
  const { missing, explicit, creatorSeat, before } = await t.run(async ctx => {
    const creator = await ctx.db.insert("users", { name: "Creator" });
    const tab = await ctx.db.insert("tabs", { slug: "trip", name: "Trip", ownerUserId: creator, updatedAt: 1 });
    const otherSeat = await ctx.db.insert("tabMembers", { tabId: tab, name: "Other", inviteToken: "other" });
    const creatorSeat = await ctx.db.insert("tabMembers", { tabId: tab, name: "Creator", userId: creator, inviteToken: "creator" });
    const data = { userId: creator, tabId: tab, name: "Dinner", mode: "simple" as const, items: [], date: "2026-09-12", updatedAt: 123 };
    const missing = await ctx.db.insert("expenses", { ...data, slug: "missing" });
    const explicit = await ctx.db.insert("expenses", { ...data, slug: "explicit", payerId: otherSeat });
    return { missing, explicit, creatorSeat, before: [await ctx.db.get(missing), await ctx.db.get(explicit)] };
  });
  await t.run(ctx => runToCompletion(ctx, components.migrations, internal.payerMigration.backfillCreatorPayer));
  expect(await t.run(ctx => ctx.db.get(missing))).toEqual({ ...before[0], payerId: creatorSeat });
  expect(await t.run(ctx => ctx.db.get(explicit))).toEqual(before[1]);
  await t.run(ctx => runToCompletion(ctx, components.migrations, internal.payerMigration.backfillCreatorPayer));
  expect(await t.query(internal.payerMigration.audit, { paginationOpts: { cursor: null, numItems: 100 } })).toMatchObject({ total: 2, missing: 0, invalid: 0, unmappedCreators: 0, isDone: true });
});
