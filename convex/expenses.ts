import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { resolveMemberName } from "./tabs";
import { mutation, query } from "./_generated/server";
import { expenseState } from "./schema";
import { isAcceptedImageType, MAX_IMAGE_BYTES } from "./imageFormats";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { Infer } from "convex/values";

// A note that's empty (or only whitespace) means "no note" - it's stored as an
// absent field rather than an empty string, so saving a blank note deletes it.
// Patching the field to `undefined` is what removes it from an existing doc.
function withNormalizedNote(state: Infer<typeof expenseState>) {
  return { ...state, note: state.note?.trim() || undefined };
}

// The client uploads straight to Convex storage, so the file's real size and
// type are only knowable here, from the stored file's metadata - re-check both
// before letting a file be attached rather than trusting the browser's checks.
async function assertValidImage(ctx: MutationCtx, storageId: Id<"_storage">) {
  const metadata = await ctx.db.system.get("_storage", storageId);
  if (!metadata) throw new Error("That upload is no longer available - try again.");
  if (metadata.size > MAX_IMAGE_BYTES) throw new Error("Images must be 5MB or smaller.");
  if (!metadata.contentType || !isAcceptedImageType(metadata.contentType)) {
    throw new Error("That file type isn't supported.");
  }
}

// Storage files aren't reachable once nothing points at them, so drop the old
// file whenever an expense's image is replaced, removed, or the whole expense
// goes away - otherwise every swapped-out receipt is billed storage forever.
async function deleteImageIfUnused(
  ctx: MutationCtx,
  previous: Id<"_storage"> | undefined,
  next: Id<"_storage"> | undefined,
) {
  if (previous && previous !== next) await ctx.storage.delete(previous);
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    return await ctx.storage.generateUploadUrl();
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const docs = await ctx.db
      .query("expenses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return docs.map(({ slug, currency, ...state }) => ({ slug, state: { ...state, currency: currency ?? "USD" } }));
  },
});

export const get = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const doc = await ctx.db
      .query("expenses")
      .withIndex("by_user_slug", (q) => q.eq("userId", userId).eq("slug", slug))
      .unique();
    if (!doc) return null;
    const { stage, name, people, namePeople, mode, items, date, contributions, currency, note, image, tabId, tabMemberIds } =
      doc;
    const tab = tabId ? await ctx.db.get(tabId) : null;

    // Flag people linked to a still-anonymous tab member, so the expense
    // form can show the same indicator the tab's roster does. Also list
    // tab members not yet on this expense, so the expense form can offer
    // them (or a brand-new person) as the only way to add someone once an
    // expense belongs to a tab.
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
      mode,
      items,
      date,
      contributions,
      currency: currency ?? "USD",
      note,
      // The stored file is only reachable through a signed URL, minted per read.
      image: image ? { ...image, url: await ctx.storage.getUrl(image.storageId) } : undefined,
      tab: tab ? { slug: tab.slug, name: tab.name } : null,
      anonymousPersonIds,
      availableTabMembers,
    };
  },
});

export const save = mutation({
  args: { slug: v.string(), state: expenseState },
  handler: async (ctx, { slug, state }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const existing = await ctx.db
      .query("expenses")
      .withIndex("by_user_slug", (q) => q.eq("userId", userId).eq("slug", slug))
      .unique();

    if (state.items.length === 0) {
      if (existing) {
        await deleteImageIfUnused(ctx, existing.image?.storageId, undefined);
        await ctx.db.delete(existing._id);
      }
      return;
    }

    if (state.image && state.image.storageId !== existing?.image?.storageId) {
      await assertValidImage(ctx, state.image.storageId);
    }

    const normalized = withNormalizedNote(state);
    if (existing) {
      await deleteImageIfUnused(ctx, existing.image?.storageId, state.image?.storageId);
      // `image` is spelled out so the key is always present: the client omits
      // it when there's no image, and only a present-but-undefined field
      // removes an image already on the doc.
      await ctx.db.patch(existing._id, { ...normalized, image: state.image, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("expenses", { slug, userId, ...normalized, updatedAt: Date.now() });
    }
  },
});

export const remove = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const existing = await ctx.db
      .query("expenses")
      .withIndex("by_user_slug", (q) => q.eq("userId", userId).eq("slug", slug))
      .unique();
    if (!existing) return;
    await deleteImageIfUnused(ctx, existing.image?.storageId, undefined);
    await ctx.db.delete(existing._id);
  },
});

export const importLocal = mutation({
  args: { expenses: v.array(v.object({ slug: v.string(), state: expenseState })) },
  handler: async (ctx, { expenses }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    for (const { slug, state } of expenses) {
      if (state.items.length === 0) continue;
      const existing = await ctx.db
        .query("expenses")
        .withIndex("by_user_slug", (q) => q.eq("userId", userId).eq("slug", slug))
        .unique();
      if (!existing) {
        // Guest expenses can't carry an image (uploading needs an account),
        // but the shape allows one, so validate anything that shows up.
        if (state.image) await assertValidImage(ctx, state.image.storageId);
        await ctx.db.insert("expenses", { slug, userId, ...withNormalizedNote(state), updatedAt: Date.now() });
      }
    }
  },
});
