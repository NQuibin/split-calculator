import { resolveExpenseMembers, assertExpenseMembers } from "./expenseMembers";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { listTabsForUser } from "./tabs";
import { computeSplit, round2 } from "../src/lib/calculations";
import { mutation, query } from "./_generated/server";
import { expenseState, person } from "./schema";
import { isAcceptedImageType, MAX_IMAGE_BYTES } from "./imageFormats";
import { forbidden, requireUserId, unauthenticated } from "./authz";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { Infer } from "convex/values";

// A note that's empty (or only whitespace) means "no note" - it's stored as an
// absent field rather than an empty string, so saving a blank note deletes it.
// Patching the field to `undefined` is what removes it from an existing doc.
function withNormalizedNote(state: Infer<typeof expenseState>) {
  const data = { ...state };
  // The client's roster is accepted but never stored: the tab's seats are the
  // only source of truth for who is on an expense, and the doc has no `people`
  // field to spread this into.
  delete (data as { people?: unknown }).people;
  return { ...data, note: state.note?.trim() || undefined };
}

// The client uploads straight to Convex storage, so the file's real size and
// type are only knowable here, from the stored file's metadata - re-check both
// before letting a file be attached rather than trusting the browser's checks.
export async function assertValidImage(ctx: MutationCtx, storageId: Id<"_storage">) {
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

/**
 * Removes an expense and the receipt file it holds. Storage isn't reachable
 * once nothing points at it, so the file has to go with the document - every
 * path that deletes an expense goes through here to keep that true.
 */
export async function deleteExpenseDoc(ctx: MutationCtx, expense: Doc<"expenses">) {
  await deleteImageIfUnused(ctx, expense.image?.storageId, undefined);
  await ctx.db.delete(expense._id);
}

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireUserId(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * The caller's own expense with this slug, or `null` when nobody has one.
 * An expense that exists but belongs to somebody else is never returned - the
 * caller gets an access error, so a shared `/e/{slug}` link lands on a
 * forbidden page rather than silently looking like a brand-new expense.
 */
async function ownExpenseOrDeny(ctx: QueryCtx | MutationCtx, slug: string) {
  const userId = await getAuthUserId(ctx);
  if (userId) {
    const own = await ctx.db
      .query("expenses")
      .withIndex("by_user_slug", (q) => q.eq("userId", userId).eq("slug", slug))
      .unique();
    if (own) return own;
  }
  // `first`, not `unique`: per-user uniqueness is all the schema guarantees,
  // and any hit at all means this slug isn't the caller's to use.
  const other = await ctx.db
    .query("expenses")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .first();
  if (!other) return null;
  if (!userId) unauthenticated();
  forbidden();
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const docs = await ctx.db
      .query("expenses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return (await Promise.all(docs.map(doc => resolveExpenseMembers(ctx, doc)))).map(({ slug, currency, ...state }) => ({ slug, state: { ...state, stage: "receipt" as const, currency: currency ?? "USD" } }));
  },
});

// Every row the expenses directory renders - the user's own expenses plus the
// expenses of every tab they belong to - merged and sorted in one subscription.
// The directory used to fetch `expenses.list` and `tabs.list` and then fan out
// `tabs.expensesForTab` per tab, so the page couldn't render until N+2 round
// trips had landed. `kind`/`tabSlug` are returned instead of a built href so
// URL shape stays a client concern.
export const directory = query({
  args: {},
  returns: v.array(
    v.object({
      key: v.string(),
      kind: v.union(v.literal("own"), v.literal("tab")),
      slug: v.string(),
      tabSlug: v.optional(v.string()),
      name: v.string(),
      tabName: v.string(),
      people: v.array(person),
      itemCount: v.number(),
      currency: v.string(),
      total: v.number(),
      date: v.string(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await expenseDirectoryForUser(ctx, userId);
  },
});

export async function expenseDirectoryForUser(ctx: QueryCtx, userId: Id<"users">) {
  const ownDocs = await ctx.db
    .query("expenses")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  const own = await Promise.all(ownDocs.map(doc => resolveExpenseMembers(ctx, doc)));
  const rows: {
    key: string;
    kind: "own" | "tab";
    slug: string;
    tabSlug?: string;
    name: string;
    tabName: string;
    people: Infer<typeof person>[];
    itemCount: number;
    currency: string;
    total: number;
    date: string;
    updatedAt: number;
  }[] = own.map((e) => ({
    key: `own-${e.slug}`,
    kind: "own",
    slug: e.slug,
    tabSlug: undefined,
    name: e.name,
    tabName: "Personal expense",
    people: e.people,
    itemCount: e.items.length,
    currency: e.currency ?? "USD",
    total: round2(computeSplit(e.people, e.items, e.globalAdjustments).grandTotal),
    date: e.date,
    updatedAt: e.updatedAt,
  }));

  for (const tab of await listTabsForUser(ctx, userId)) {
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_tab", (q) => q.eq("tabId", tab._id))
      .collect();
    for (const raw of expenses) {
      const e = await resolveExpenseMembers(ctx, raw);
      // An owned expense appears once, with its tab name. Shared expenses
      // open the tab's existing read-only view, not the owner-only editor.
      const owned =
        tab.ownerUserId === userId ? rows.find((row) => row.slug === e.slug) : undefined;
      if (owned) {
        owned.tabName = tab.name;
        continue;
      }
      rows.push({
        key: `${tab.slug}-${e.slug}`,
        kind: "tab",
        slug: e.slug,
        tabSlug: tab.slug,
        name: e.name || "Untitled expense",
        tabName: tab.name,
        people: e.people,
        itemCount: e.items.length,
        currency: e.currency ?? "USD",
        total: round2(computeSplit(e.people, e.items, e.globalAdjustments).grandTotal),
        date: e.date,
        updatedAt: e.updatedAt,
      });
    }
  }

  // The directory is the user's working set: most recently edited first.
  return rows.sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name));
}

export const get = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const doc = await ownExpenseOrDeny(ctx, slug);
    if (!doc) return null;
    const { name, people, mode, items, payerId, globalAdjustments, date, currency, note, image, tabId } =
      await resolveExpenseMembers(ctx, doc);
    const tab = tabId ? await ctx.db.get(tabId) : null;

    return {
      stage: "receipt" as const,
      name,
      people,
      mode,
      items,
      payerId,
      globalAdjustments,
      date,
      currency: currency ?? "USD",
      note,
      // The stored file is only reachable through a signed URL, minted per read.
      image: image ? { ...image, url: await ctx.storage.getUrl(image.storageId) } : undefined,
      tab: tab ? { slug: tab.slug, name: tab.name } : null,

    };
  },
});

export const save = mutation({
  args: { slug: v.string(), state: expenseState },
  returns: v.null(),
  handler: async (ctx, { slug, state }) => {
    await requireUserId(ctx);
    const existing = await ownExpenseOrDeny(ctx, slug);
    if (!existing) throw new Error("Choose a tab to create an expense");

    if (state.image && state.image.storageId !== existing.image?.storageId) {
      await assertValidImage(ctx, state.image.storageId);
    }

    const resolved = await resolveExpenseMembers(ctx, existing);
    const roundingOrder = resolved.people.map(person => person.id) as Id<"tabMembers">[];
    const normalized = withNormalizedNote(state);
    await assertExpenseMembers(ctx, { ...normalized, tabId: existing.tabId, payerId: state.payerId });
    if (existing) {
      await deleteImageIfUnused(ctx, existing.image?.storageId, state.image?.storageId);
      // `image` is spelled out so the key is always present: the client omits
      // it when there's no image, and only a present-but-undefined field
      // removes an image already on the doc.
      await ctx.db.patch(existing._id, { ...normalized, payerId: state.payerId as Id<"tabMembers">, memberReferencesVersion: 1, roundingOrder, image: state.image, globalAdjustments: state.globalAdjustments, ...((state.currency ?? "USD") !== (existing.currency ?? "USD") ? { exchangeRate: undefined } : {}), updatedAt: Date.now() });
    }
    return null;
  },
});

export const remove = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    await requireUserId(ctx);
    const existing = await ownExpenseOrDeny(ctx, slug);
    if (!existing) return;
    await deleteExpenseDoc(ctx, existing);
  },
});
