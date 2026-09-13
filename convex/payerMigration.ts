import { Migrations } from "@convex-dev/migrations";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { internalQuery } from "./_generated/server";
import schema from "./schema";

const migrations = new Migrations(components.migrations, { schema });

/** Only fill absent payers; an explicit payment assignment takes precedence. */
export const backfillCreatorPayer = migrations.define({
  table: "expenses",
  migrateOne: async (ctx, expense) => {
    if (expense.payerId) return;
    if (!expense.tabId) throw new Error(`Expense ${expense._id} has no tab`);
    const seats = await ctx.db
      .query("tabMembers")
      .withIndex("by_tab", (q) => q.eq("tabId", expense.tabId!))
      .take(501);
    if (seats.length > 500) throw new Error("Tab roster exceeds migration batch limit");
    const creators = seats.filter((seat) => seat.userId === expense.userId);
    if (creators.length !== 1)
      throw new Error(`Expense ${expense._id} needs exactly one creator seat`);
    return { payerId: creators[0]._id };
  },
});

/** Count and validate in pages without returning expense content or personal data. */
export const audit = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    total: v.number(),
    missing: v.number(),
    invalid: v.number(),
    unmappedCreators: v.number(),
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, { paginationOpts }) => {
    const page = await ctx.db.query("expenses").paginate(paginationOpts);
    let missing = 0,
      invalid = 0,
      unmappedCreators = 0;
    for (const expense of page.page) {
      if (expense.payerId) {
        const seat = await ctx.db.get(expense.payerId);
        if (!seat || seat.tabId !== expense.tabId) invalid++;
      } else {
        missing++;
        const seats = expense.tabId
          ? await ctx.db
              .query("tabMembers")
              .withIndex("by_tab", (q) => q.eq("tabId", expense.tabId!))
              .take(501)
          : [];
        if (
          seats.length > 500 ||
          seats.filter((seat) => seat.userId === expense.userId).length !== 1
        )
          unmappedCreators++;
      }
    }
    return {
      total: page.page.length,
      missing,
      invalid,
      unmappedCreators,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});
