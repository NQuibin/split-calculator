import { internalQuery } from "../_generated/server";
import { v } from "convex/values";

/**
 * Verification for the removal of "Who's paid so far".
 *
 * `contributions` was a required column, so it could not simply be dropped from
 * the schema - Convex validates every existing document against the new schema
 * on push and would have rejected it. The sequence was: make the column
 * optional and stop writing it, deploy, clear the field from every document,
 * then delete the column and deploy again.
 *
 * The `clear` mutation that did the middle step is retained in git history; it
 * stopped compiling the moment the column left the schema, which is the same
 * signal that the cleanup was complete. Both deployments were verified at
 * `remaining: 0` before the column was removed.
 */

/** Aggregate verification only; never returns expense contents. */
export const audit = internalQuery({
  args: {},
  returns: v.object({ total: v.number(), remaining: v.number() }),
  handler: async ctx => {
    let total = 0, remaining = 0;
    for await (const doc of ctx.db.query("expenses")) {
      total++;
      if ("contributions" in doc) remaining++;
    }
    return { total, remaining };
  },
});
