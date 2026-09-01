import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { receiptState } from "./schema";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const docs = await ctx.db
      .query("receipts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return docs.map(({ slug, ...state }) => ({ slug, state }));
  },
});

export const get = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const doc = await ctx.db
      .query("receipts")
      .withIndex("by_user_slug", (q) => q.eq("userId", userId).eq("slug", slug))
      .unique();
    if (!doc) return null;
    const { stage, people, namePeople, items, tax, tip, date, contributions } = doc;
    return { stage, people, namePeople, items, tax, tip, date, contributions };
  },
});

export const save = mutation({
  args: { slug: v.string(), state: receiptState },
  handler: async (ctx, { slug, state }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const existing = await ctx.db
      .query("receipts")
      .withIndex("by_user_slug", (q) => q.eq("userId", userId).eq("slug", slug))
      .unique();

    if (state.items.length === 0) {
      if (existing) await ctx.db.delete(existing._id);
      return;
    }

    if (existing) {
      await ctx.db.patch(existing._id, { ...state, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("receipts", { slug, userId, ...state, updatedAt: Date.now() });
    }
  },
});

export const remove = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const existing = await ctx.db
      .query("receipts")
      .withIndex("by_user_slug", (q) => q.eq("userId", userId).eq("slug", slug))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const importLocal = mutation({
  args: { receipts: v.array(v.object({ slug: v.string(), state: receiptState })) },
  handler: async (ctx, { receipts }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    for (const { slug, state } of receipts) {
      if (state.items.length === 0) continue;
      const existing = await ctx.db
        .query("receipts")
        .withIndex("by_user_slug", (q) => q.eq("userId", userId).eq("slug", slug))
        .unique();
      if (!existing) {
        await ctx.db.insert("receipts", { slug, userId, ...state, updatedAt: Date.now() });
      }
    }
  },
});
