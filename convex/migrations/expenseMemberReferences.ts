import type { Id } from "../_generated/dataModel";
import { internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { Migrations } from "@convex-dev/migrations";
import { components } from "../_generated/api";
import schema from "../schema";
import { assertExpenseMembers, resolveExpenseMembers } from "../expenseMembers";

const migrations = new Migrations(components.migrations, { schema });

/** Idempotent, batched conversion; no balances, timestamps, or selections change. */
export const migrate = migrations.define({
  table: "expenses",
  migrateOne: async (ctx, doc) => {
    if (!doc.tabId || doc.memberReferencesVersion === 1) return;
    const resolved = await resolveExpenseMembers(ctx, doc);
    await assertExpenseMembers(ctx, resolved);
    return {
      roundingOrder: resolved.people.map(person => person.id) as Id<"tabMembers">[],
      items: resolved.items,
      contributions: resolved.contributions,
      people: undefined,
      tabMemberIds: undefined,
      memberReferencesVersion: 1 as const,
    };
  },
});

/** Aggregate verification only; never returns expense contents. */
export const audit = internalQuery({
  args: {},
  returns: v.object({ total: v.number(), legacy: v.number(), normalized: v.number(), invalid: v.number(), stages: v.number(), mappings: v.number() }),
  handler: async ctx => {
    let total = 0, legacy = 0, normalized = 0, invalid = 0, stages = 0, mappings = 0;
    for await (const doc of ctx.db.query("expenses")) {
      total++;
      if (doc.stage !== undefined) stages++;
      if (doc.tabMemberIds !== undefined) mappings++;
      if (!doc.tabId) continue;
      if (doc.memberReferencesVersion === 1) normalized++; else legacy++;
      try { await assertExpenseMembers(ctx, await resolveExpenseMembers(ctx, doc)); }
      catch { invalid++; }
    }
    return { total, legacy, normalized, invalid, stages, mappings };
  },
});


export const removeStage = migrations.define({
  table: "expenses",
  migrateOne: () => ({ stage: undefined }),
});
