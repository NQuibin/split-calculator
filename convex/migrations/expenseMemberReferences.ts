import { internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { assertExpenseMembers, resolveExpenseMembers } from "../expenseMembers";

// The completed migration is retained in commit 3120867. Both deployments
// were verified clean before removing the legacy fields from the schema.
/** Aggregate verification only; never returns expense contents. */
export const audit = internalQuery({
  args: {},
  returns: v.object({ total: v.number(), legacy: v.number(), normalized: v.number(), invalid: v.number(), stages: v.number(), mappings: v.number() }),
  handler: async ctx => {
    let total = 0, legacy = 0, normalized = 0, invalid = 0, stages = 0, mappings = 0;
    for await (const doc of ctx.db.query("expenses")) {
      total++;
      if ("stage" in doc) stages++;
      if ("tabMemberIds" in doc) mappings++;
      if (!doc.tabId) continue;
      if (doc.memberReferencesVersion === 1) normalized++; else legacy++;
      try { await assertExpenseMembers(ctx, await resolveExpenseMembers(ctx, doc)); }
      catch { invalid++; }
    }
    return { total, legacy, normalized, invalid, stages, mappings };
  },
});

