import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { resolveMemberName } from "./tabs";
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
    const { stage, name, people, namePeople, items, tax, tip, date, contributions, tabId, tabMemberIds } = doc;
    const tab = tabId ? await ctx.db.get(tabId) : null;

    // Flag people linked to a still-anonymous tab member, so the receipt
    // form can show the same indicator the tab's roster does. Also list
    // tab members not yet on this receipt, so the receipt form can offer
    // them (or a brand-new person) as the only way to add someone once a
    // receipt belongs to a tab.
    let anonymousPersonIds: string[] = [];
    let availableTabMembers: { id: string; name: string }[] = [];
    if (tab) {
      const linkedMemberIds = new Set((tabMemberIds ?? []).map((link) => link.memberId));
      const anonymousMemberIds = new Set(tab.members.filter((m) => !m.claimedByUserId).map((m) => m.id));
      anonymousPersonIds = (tabMemberIds ?? [])
        .filter((link) => anonymousMemberIds.has(link.memberId))
        .map((link) => link.personId);
      availableTabMembers = await Promise.all(
        tab.members
          .filter((m) => !linkedMemberIds.has(m.id))
          .map(async (m) => ({ id: m.id, name: await resolveMemberName(ctx, m) })),
      );
    }

    return {
      stage,
      name,
      people,
      namePeople,
      items,
      tax,
      tip,
      date,
      contributions,
      tab: tab ? { slug: tab.slug, name: tab.name } : null,
      anonymousPersonIds,
      availableTabMembers,
    };
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
