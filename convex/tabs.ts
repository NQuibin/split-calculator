import { assertValidImage, deleteExpenseDoc } from "./expenses";
import { activeExchangeRate, convertSettlement } from "../src/lib/exchangeRate";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { computeSettlement, computeSplit, round2 } from "../src/lib/calculations";
import { person, expenseItem, expenseMode, expenseState } from "./schema";
import { normalizeMemberName } from "../src/lib/tabMembers";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { forbidden, isInviteToken, requireTabOwner, requireTabViewer, requireUserId } from "./authz";
import type { Doc, Id } from "./_generated/dataModel";

async function getTabBySlug(ctx: QueryCtx | MutationCtx, slug: string) {
  return await ctx.db
    .query("tabs")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
}

/**
 * A tab the caller is allowed to read, or `null` when no tab has that slug.
 * A caller who isn't in the tab never gets a document back - they get an
 * access error, which the client turns into a forbidden page.
 */
async function viewableTab(ctx: QueryCtx | MutationCtx, slug: string) {
  const tab = await getTabBySlug(ctx, slug);
  if (!tab) return null;
  const userId = await requireTabViewer(ctx, tab);
  return { tab, userId };
}

/** A tab the caller owns. Throws rather than returning null - every caller here is acting on it. */
async function ownedTab(ctx: QueryCtx | MutationCtx, slug: string) {
  // Checked up front so a signed-out caller is told to sign in rather than
  // told whether the slug exists.
  await requireUserId(ctx);
  const tab = await getTabBySlug(ctx, slug);
  if (!tab) throw new Error("Tab not found");
  const userId = await requireTabOwner(ctx, tab);
  return { tab, userId };
}

/**
 * Reconciles a tab's `tabMembers` rows to its `members[]` array - phase 1 of
 * moving the roster into its own table. The array is still authoritative, so
 * every mutation that writes it calls this with the array it just wrote and
 * the rows follow.
 *
 * Written as a reconcile rather than per-operation inserts and deletes so
 * there is one mirroring rule instead of seven, and so it is idempotent:
 * running it against an already-matching tab does nothing, which is also
 * what makes it reusable as the phase 2 backfill.
 */
export async function syncTabMembers(
  ctx: MutationCtx,
  tabId: Id<"tabs">,
  members: Doc<"tabs">["members"],
) {
  const existing = await ctx.db
    .query("tabMembers")
    .withIndex("by_tab", (q) => q.eq("tabId", tabId))
    .collect();
  const unvisited = new Map(existing.map((row) => [row.memberId, row]));

  for (const member of members) {
    const row = unvisited.get(member.id);
    const fields = { name: member.name, inviteToken: member.inviteToken, userId: member.claimedByUserId };
    if (!row) {
      await ctx.db.insert("tabMembers", { tabId, memberId: member.id, ...fields });
      continue;
    }
    unvisited.delete(member.id);
    if (row.name !== fields.name || row.inviteToken !== fields.inviteToken || row.userId !== fields.userId) {
      await ctx.db.patch(row._id, fields);
    }
  }

  // Whatever the array no longer lists has been removed from the roster.
  for (const stale of unvisited.values()) await ctx.db.delete(stale._id);
}

function requireUniqueName(members: Doc<"tabs">["members"], name: string, excludeId?: string) {
  const normalized = normalizeMemberName(name);
  const collision = members.some((m) => m.id !== excludeId && normalizeMemberName(m.name) === normalized);
  if (collision) throw new Error(`"${name.trim()}" is already in this tab`);
}

async function getDisplayName(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  return user?.name?.trim() || user?.email?.trim() || "You";
}

// Claimed members show their account's current name (falling back to email)
// rather than the name frozen into the member row when they were added or
// claimed - so a later Settings rename is reflected everywhere they appear.
export async function resolveMemberName(ctx: QueryCtx | MutationCtx, member: Doc<"tabs">["members"][number]) {
  if (!member.claimedByUserId) return member.name;
  const user = await ctx.db.get(member.claimedByUserId);
  return user?.name?.trim() || user?.email?.trim() || member.name;
}

// Every tab the user can see: the ones they own plus the ones they've claimed
// a member slot in, deduped (owning a tab you also hold a slot in is common).
export async function listTabsForUser(ctx: QueryCtx, userId: Id<"users">) {
  const owned = await ctx.db
    .query("tabs")
    .withIndex("by_owner", (q) => q.eq("ownerUserId", userId))
    .collect();

  const memberships = await ctx.db
    .query("tabMemberships")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const claimedTabs = (
    await Promise.all(memberships.map((m) => ctx.db.get(m.tabId)))
  ).filter((t): t is Doc<"tabs"> => t !== null);

  const byId = new Map<string, Doc<"tabs">>();
  for (const t of [...owned, ...claimedTabs]) byId.set(t._id, t);
  return Array.from(byId.values());
}

async function resolveMembers(ctx: QueryCtx, tab: Doc<"tabs">) {
  return await Promise.all(
    tab.members.map(async (m) => ({
      id: m.id,
      name: await resolveMemberName(ctx, m),
      claimed: m.claimedByUserId !== undefined,
      // The identity a person gets remapped to once assigned to this tab
      // (see createExpense) - lets a brand-new expense started from this
      // tab already carry a claimed member's real account id, instead of
      // only picking it up once explicitly assigned.
      resolvedId: m.claimedByUserId ?? m.id,
    })),
  );
}

export const create = mutation({
  args: { slug: v.string(), name: v.string(), memberNames: v.array(v.string()) },
  handler: async (ctx, { slug, name, memberNames }) => {
    const userId = await requireUserId(ctx);

    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("Tab name is required");

    // The creator is always the tab's first member - a tab can't exist
    // without at least the person who made it.
    const creatorName = await getDisplayName(ctx, userId);
    const creator = await ctx.db.get(userId);

    const trimmedMemberNames = memberNames.map((n) => n.trim()).filter((n) => n.length > 0);

    const seen = new Set<string>([normalizeMemberName(creatorName)]);
    for (const memberName of trimmedMemberNames) {
      const normalized = normalizeMemberName(memberName);
      if (seen.has(normalized)) throw new Error(`"${memberName}" is listed more than once`);
      seen.add(normalized);
    }

    const existing = await getTabBySlug(ctx, slug);
    if (existing) throw new Error("Slug already taken");

    const members = [
      { id: crypto.randomUUID(), name: creatorName, claimedByUserId: userId, inviteToken: crypto.randomUUID() },
      ...trimmedMemberNames.map((memberName) => ({
        id: crypto.randomUUID(),
        name: memberName,
        inviteToken: crypto.randomUUID(),
      })),
    ];

    const tabId = await ctx.db.insert("tabs", {
      slug,
      ownerUserId: userId,
      name: trimmedName,
      members,
      defaultCurrency: creator?.defaultCurrency ?? "USD",
      updatedAt: Date.now(),
    });
    await syncTabMembers(ctx, tabId, members);
  },
});

export const rename = mutation({
  args: { slug: v.string(), name: v.string() },
  handler: async (ctx, { slug, name }) => {
    const { tab } = await ownedTab(ctx, slug);

    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("Tab name is required");
    await ctx.db.patch(tab._id, { name: trimmedName, updatedAt: Date.now() });
  },
});

export const setDefaultCurrency = mutation({
  args: { slug: v.string(), currency: v.string() },
  handler: async (ctx, { slug, currency }) => {
    const { tab } = await ownedTab(ctx, slug);

    await ctx.db.patch(tab._id, { defaultCurrency: currency, updatedAt: Date.now() });
  },
});

export const deleteTab = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { tab } = await ownedTab(ctx, slug);

    // The tab's expenses go with it. They used to be unlinked and kept, but a
    // signed-in expense can no longer exist outside a tab, so that left rows
    // the app has no way to recreate - and an expense's people, splits and
    // balances only mean anything inside the tab that defined them.
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_tab", (q) => q.eq("tabId", tab._id))
      .collect();
    for (const expense of expenses) {
      await deleteExpenseDoc(ctx, expense);
    }

    for (const member of tab.members) {
      if (!member.claimedByUserId) continue;
      const memberships = await ctx.db
        .query("tabMemberships")
        .withIndex("by_user", (q) => q.eq("userId", member.claimedByUserId!))
        .collect();
      const stale = memberships.find((m) => m.tabId === tab._id);
      if (stale) await ctx.db.delete(stale._id);
    }

    await syncTabMembers(ctx, tab._id, []);
    await ctx.db.delete(tab._id);
  },
});

export const addMember = mutation({
  args: { slug: v.string(), name: v.string() },
  handler: async (ctx, { slug, name }) => {
    const { tab } = await ownedTab(ctx, slug);

    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("Member name is required");
    requireUniqueName(tab.members, trimmedName);

    const members = [...tab.members, { id: crypto.randomUUID(), name: trimmedName, inviteToken: crypto.randomUUID() }];
    await ctx.db.patch(tab._id, { members, updatedAt: Date.now() });
    await syncTabMembers(ctx, tab._id, members);
  },
});

export const renameMember = mutation({
  args: { slug: v.string(), memberId: v.string(), name: v.string() },
  handler: async (ctx, { slug, memberId, name }) => {
    const { tab } = await ownedTab(ctx, slug);

    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("Member name is required");
    if (!tab.members.some((m) => m.id === memberId)) throw new Error("Member not found");
    requireUniqueName(tab.members, trimmedName, memberId);

    const members = tab.members.map((m) => (m.id === memberId ? { ...m, name: trimmedName } : m));
    await ctx.db.patch(tab._id, { members, updatedAt: Date.now() });
    await syncTabMembers(ctx, tab._id, members);
  },
});

export const removeMember = mutation({
  args: { slug: v.string(), memberId: v.string() },
  handler: async (ctx, { slug, memberId }) => {
    const { tab } = await ownedTab(ctx, slug);

    const removed = tab.members.find((m) => m.id === memberId);
    if (!removed) throw new Error("Member not found");
    if (removed.claimedByUserId === tab.ownerUserId) {
      throw new Error("The tab creator can't be removed");
    }

    const members = tab.members.filter((m) => m.id !== memberId);
    await ctx.db.patch(tab._id, { members, updatedAt: Date.now() });
    await syncTabMembers(ctx, tab._id, members);

    // If the removed slot was that user's only claimed slot in this tab, drop
    // the membership row too, so a removed member's account stops seeing this
    // tab in their own "My Tabs" list.
    if (removed?.claimedByUserId) {
      const stillClaims = members.some((m) => m.claimedByUserId === removed.claimedByUserId);
      if (!stillClaims) {
        const memberships = await ctx.db
          .query("tabMemberships")
          .withIndex("by_user", (q) => q.eq("userId", removed.claimedByUserId!))
          .collect();
        const stale = memberships.find((m) => m.tabId === tab._id);
        if (stale) await ctx.db.delete(stale._id);
      }
    }
  },
});

export const claimMember = mutation({
  args: { slug: v.string(), token: v.string() },
  handler: async (ctx, { slug, token }) => {
    const userId = await requireUserId(ctx);
    const tab = await getTabBySlug(ctx, slug);
    if (!tab) throw new Error("Tab not found");

    const member = tab.members.find((m) => m.inviteToken === token);
    if (!member) throw new Error("Invalid invite link");
    if (member.claimedByUserId === userId) return;
    if (tab.ownerUserId === userId) {
      throw new Error("You created this tab, so you're already a member");
    }
    if (member.claimedByUserId) throw new Error("This spot has already been claimed");
    if (tab.members.some((m) => m.claimedByUserId === userId)) {
      throw new Error("You're already a member of this tab");
    }

    const members = tab.members.map((m) => (m.id === member.id ? { ...m, claimedByUserId: userId } : m));
    await ctx.db.patch(tab._id, { members, updatedAt: Date.now() });
    await syncTabMembers(ctx, tab._id, members);

    const existingMembership = await ctx.db
      .query("tabMemberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (!existingMembership.some((m) => m.tabId === tab._id)) {
      await ctx.db.insert("tabMemberships", { userId, tabId: tab._id });
    }
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return (await listTabsForUser(ctx, userId)).map((t) => ({
      slug: t.slug,
      name: t.name,
      isOwner: t.ownerUserId === userId,
      memberCount: t.members.length,
    }));
  },
});

// Everything the tabs directory renders for every tab, in one subscription.
// The directory used to fetch `list` and then fan out `getBySlug` +
// `expensesForTab` per row, which cost 1 + 2N round trips and let each row
// resolve on its own schedule (members and totals popping in one row at a
// time). Fanning out here instead keeps it to a single transaction of local
// reads, so the whole page resolves at once.
export const listWithSummary = query({
  args: {},
  returns: v.array(
    v.object({
      slug: v.string(),
      name: v.string(),
      isOwner: v.boolean(),
      memberCount: v.number(),
      defaultCurrency: v.string(),
      members: v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          claimed: v.boolean(),
          resolvedId: v.string(),
        }),
      ),
      expenseCount: v.number(),
      // Kept split by currency rather than summed - adding incompatible
      // currencies together would be meaningless. Sorted by code so the row
      // renders in a stable order without the client re-sorting.
      totals: v.array(v.object({ currency: v.string(), total: v.number() })),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await summarizeTabsForUser(ctx, userId);
  },
});

export async function summarizeTabsForUser(ctx: QueryCtx, userId: Id<"users">) {
  const tabs = await listTabsForUser(ctx, userId);
  return await Promise.all(
    tabs.map(async (tab) => {
      const expenses = await ctx.db
        .query("expenses")
        .withIndex("by_tab", (q) => q.eq("tabId", tab._id))
        .collect();

      const totals = new Map<string, number>();
      for (const expense of expenses) {
        const code = expense.currency ?? "USD";
        const { grandTotal } = computeSplit(expense.people, expense.items);
        totals.set(code, (totals.get(code) ?? 0) + grandTotal);
      }

      return {
        slug: tab.slug,
        name: tab.name,
        isOwner: tab.ownerUserId === userId,
        memberCount: tab.members.length,
        defaultCurrency: tab.defaultCurrency ?? "USD",
        members: await resolveMembers(ctx, tab),
        expenseCount: expenses.length,
        totals: [...totals]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([currency, total]) => ({ currency, total: round2(total) })),
      };
    }),
  );
}

// The people the user shares tabs with, deduped across tabs, in one
// subscription - replacing a `list` + per-tab `getBySlug` fan-out.
export const friends = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      claimed: v.boolean(),
      tabs: v.array(v.object({ slug: v.string(), name: v.string() })),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await friendsForUser(ctx, userId);
  },
});

export async function friendsForUser(ctx: QueryCtx, userId: Id<"users">) {
  // `claimed` members have an account behind them, so they merge across tabs
  // by user id. Anonymous ones are per-tab placeholder slots keyed by their
  // own member id, so a same-named placeholder in two tabs stays two entries
  // - there's nothing tying them together until someone claims the invite.
  const people = new Map<string, { name: string; claimed: boolean; tabs: { slug: string; name: string }[] }>();
  for (const tab of await listTabsForUser(ctx, userId)) {
    for (const member of await resolveMembers(ctx, tab)) {
      // You aren't your own friend - skip every slot you've claimed yourself.
      if (member.resolvedId === userId) continue;
      const person = people.get(member.resolvedId) ?? {
        name: member.name,
        claimed: member.claimed,
        tabs: [],
      };
      person.tabs.push({ slug: tab.slug, name: tab.name });
      people.set(member.resolvedId, person);
    }
  }

  return [...people]
    .map(([id, person]) => ({ id, ...person }))
    .sort((a, b) => Number(b.claimed) - Number(a.claimed) || a.name.localeCompare(b.name));
}

// The one tab read an outsider can make, and only while holding an unclaimed
// invite token for it: the invite has to name the tab it's for before the
// visitor signs in to claim their spot. It exposes nothing the invite isn't
// already about - the tab's name and its roster. Every other tab read
// (expenses, balances, invite links) needs real membership.
export const getBySlug = query({
  args: { slug: v.string(), token: v.optional(v.string()) },
  handler: async (ctx, { slug, token }) => {
    const tab = await getTabBySlug(ctx, slug);
    if (!tab) return null;

    if (!isInviteToken(tab, token)) await requireTabViewer(ctx, tab);
    const userId = await getAuthUserId(ctx);

    return {
      slug: tab.slug,
      name: tab.name,
      isOwner: userId !== null && tab.ownerUserId === userId,
      members: await resolveMembers(ctx, tab),
      defaultCurrency: tab.defaultCurrency ?? "USD",
    };
  },
});

export const getInviteLinks = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { tab } = await ownedTab(ctx, slug);

    return tab.members
      .filter((m) => !m.claimedByUserId)
      .map((m) => ({ memberId: m.id, name: m.name, token: m.inviteToken }));
  },
});

export const createExpense = mutation({
  args: {
    tabSlug: v.string(),
    expenseSlug: v.string(),
    state: expenseState,
    memberMapping: v.array(
      v.object({
        personId: v.string(),
        memberId: v.optional(v.string()),
        newMemberName: v.optional(v.string()),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, { tabSlug, expenseSlug, state, memberMapping }) => {
    const { tab, userId } = await ownedTab(ctx, tabSlug);

    const existing = await ctx.db
      .query("expenses")
      .withIndex("by_user_slug", (q) => q.eq("userId", userId).eq("slug", expenseSlug))
      .unique();
    if (existing) throw new Error("An existing expense cannot be added to a tab");
    if (state.items.length === 0) throw new Error("Add an item before saving");
    if (state.image) await assertValidImage(ctx, state.image.storageId);
    const expense = state;

    let members = tab.members;
    const links: { personId: string; memberId: string }[] = [];
    const usedMemberIds = new Set<string>();

    for (const entry of memberMapping) {
      if (entry.memberId) {
        if (!members.some((m) => m.id === entry.memberId)) throw new Error("Member not found");
        if (usedMemberIds.has(entry.memberId)) throw new Error("Two people can't map to the same tab member");
        usedMemberIds.add(entry.memberId);
        links.push({ personId: entry.personId, memberId: entry.memberId });
        continue;
      }
      const newMemberName = entry.newMemberName?.trim();
      if (!newMemberName) throw new Error("Each person needs a member to map to");
      requireUniqueName(members, newMemberName);
      const newMember = { id: crypto.randomUUID(), name: newMemberName, inviteToken: crypto.randomUUID() };
      members = [...members, newMember];
      links.push({ personId: entry.personId, memberId: newMember.id });
    }

    if (members !== tab.members) {
      await ctx.db.patch(tab._id, { members, updatedAt: Date.now() });
      await syncTabMembers(ctx, tab._id, members);
    }

    // Re-point each mapped person at their tab member's stable identity -
    // the claiming user's id when claimed, otherwise the member's own id -
    // and rename them to match, so the expense (people, item splits, and
    // contributions) is fully owned by the mapping just decided instead of
    // carrying whatever ids/names it had before joining the tab.
    const membersById = new Map(members.map((m) => [m.id, m]));
    const idRemap = new Map<string, string>();
    const nameByNewId = new Map<string, string>();
    for (const link of links) {
      const member = membersById.get(link.memberId);
      if (!member) continue;
      const newId = member.claimedByUserId ?? member.id;
      idRemap.set(link.personId, newId);
      nameByNewId.set(newId, await resolveMemberName(ctx, member));
    }
    const remapId = (id: string) => idRemap.get(id) ?? id;

    const people = expense.people.map((person) => {
      const id = remapId(person.id);
      return { id, name: nameByNewId.get(id) ?? person.name };
    });
    const items = expense.items.map((item) => ({ ...item, splitWith: item.splitWith.map(remapId) }));
    const contributions = expense.contributions.map((c) => ({ ...c, personId: remapId(c.personId) }));
    const tabMemberIds = links.map((link) => ({ personId: remapId(link.personId), memberId: link.memberId }));

    await ctx.db.insert("expenses", { ...state, slug: expenseSlug, userId, note: state.note?.trim() || undefined, tabId: tab._id, tabMemberIds, people, items, contributions, updatedAt: Date.now() });
    return null;
  },
});

// Once an expense belongs to a tab, its existing people are locked to the
// tab mapping decided in createExpense - the only way to change who's on
// the expense is to add someone, either an existing member not yet on this
// expense or a brand-new one (who is added to the tab at the same time).
export const addExpensePerson = mutation({
  args: {
    expenseSlug: v.string(),
    memberId: v.optional(v.string()),
    newMemberName: v.optional(v.string()),
  },
  handler: async (ctx, { expenseSlug, memberId, newMemberName }) => {
    const userId = await requireUserId(ctx);

    const expense = await ctx.db
      .query("expenses")
      .withIndex("by_user_slug", (q) => q.eq("userId", userId).eq("slug", expenseSlug))
      .unique();
    if (!expense) throw new Error("Expense not found");
    if (!expense.tabId) throw new Error("Expense is not in a tab");

    const tab = await ctx.db.get(expense.tabId);
    if (!tab) throw new Error("Tab not found");
    if (tab.ownerUserId !== userId) forbidden();

    const linkedMemberIds = new Set((expense.tabMemberIds ?? []).map((l) => l.memberId));
    let members = tab.members;
    let member: Doc<"tabs">["members"][number];

    if (memberId) {
      const found = members.find((m) => m.id === memberId);
      if (!found) throw new Error("Member not found");
      if (linkedMemberIds.has(memberId)) throw new Error("This member is already on the expense");
      member = found;
    } else {
      const trimmedName = newMemberName?.trim();
      if (!trimmedName) throw new Error("Name is required");
      requireUniqueName(members, trimmedName);
      member = { id: crypto.randomUUID(), name: trimmedName, inviteToken: crypto.randomUUID() };
      members = [...members, member];
      await ctx.db.patch(tab._id, { members, updatedAt: Date.now() });
      await syncTabMembers(ctx, tab._id, members);
    }

    const personId = member.claimedByUserId ?? member.id;
    const name = await resolveMemberName(ctx, member);

    await ctx.db.patch(expense._id, {
      people: [...expense.people, { id: personId, name }],
      tabMemberIds: [...(expense.tabMemberIds ?? []), { personId, memberId: member.id }],
    });
  },
});

export const setExpenseExchangeRate = mutation({
  args: { slug: v.string(), expenseSlug: v.string(), from: v.string(), to: v.string(), rate: v.union(v.number(), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const tab = await getTabBySlug(ctx, args.slug);
    if (!tab) throw new Error("Tab not found");
    if (tab.ownerUserId !== userId) forbidden("Only the tab owner can set exchange rates");
    const expense = await ctx.db.query("expenses").withIndex("by_user_slug", q => q.eq("userId", userId).eq("slug", args.expenseSlug)).unique();
    if (!expense || expense.tabId !== tab._id) throw new Error("Expense not found in this tab");
    if (args.from !== (expense.currency ?? "USD") || args.to !== (tab.defaultCurrency ?? "USD")) throw new Error("Currency changed. Reopen the expense and try again.");
    if (args.rate !== null && (!Number.isFinite(args.rate) || args.rate <= 0 || args.from === args.to)) throw new Error("Enter a positive exchange rate for different currencies");
    await ctx.db.patch(expense._id, { exchangeRate: args.rate === null ? undefined : { from: args.from, to: args.to, rate: args.rate }, updatedAt: Date.now() });
    return null;
  },
});

export const expensesForTab = query({
  args: { slug: v.string() },
  returns: v.array(v.object({ slug: v.string(), name: v.string(), mode: expenseMode, note: v.optional(v.string()), image: v.optional(v.object({ name: v.string(), type: v.string(), url: v.union(v.string(), v.null()) })), people: v.array(person), items: v.array(expenseItem), currency: v.string(), exchangeRate: v.optional(v.object({ from: v.string(), to: v.string(), rate: v.number() })), settlementCurrency: v.string(), createdAt: v.number(), date: v.string(), createdBy: v.object({ id: v.string(), name: v.string() }) })),
  handler: async (ctx, { slug }) => {
    const viewable = await viewableTab(ctx, slug);
    if (!viewable) return [];
    const { tab } = viewable;
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_tab", (q) => q.eq("tabId", tab._id))
      .collect();
    const creators = new Map(await Promise.all([...new Set(expenses.map(e => e.userId))].map(async id => {
      const user = await ctx.db.get(id);
      return [id, user?.name?.trim() || "Unknown creator"] as const;
    })));
    return (await Promise.all(expenses
  .map(async ({ slug, name, mode, note, image, people, items, currency, exchangeRate, _creationTime, date, userId }) => ({
        slug,
        name,
    mode,
        note,
        image: image ? { name: image.name, type: image.type, url: await ctx.storage.getUrl(image.storageId) } : undefined,
        people,
        items,
        currency: currency ?? "USD",
        exchangeRate: activeExchangeRate({ currency, exchangeRate }, tab.defaultCurrency ?? "USD"),
        settlementCurrency: activeExchangeRate({ currency, exchangeRate }, tab.defaultCurrency ?? "USD")?.to ?? currency ?? "USD",
        createdAt: _creationTime,
        date,
        createdBy: { id: userId, name: creators.get(userId) ?? "Unknown creator" },
      }))))
      // Newest first. Ordering by creation keeps a tab's list stable - editing
      // an old expense shouldn't jump it to the top of everyone else's view.
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Computes one currency's slice of the tab breakdown - member totals and
// per-expense lines - scoped to just the expenses passed in. Called once per
// distinct currency the tab's expenses use, so balances never mix currencies.
async function computeCurrencyBreakdown(
  ctx: QueryCtx,
  tab: Doc<"tabs">,
  currencyExpenses: Doc<"expenses">[],
) {
  const totals = new Map<
    string,
    { totalSpent: number; totalContributed: number; netBalance: number; expenseCount: number }
  >();
  const lines = new Map<
    string,
    {
      expenseSlug: string;
      expenseName: string;
      date: string;
      fairShare: number;
      contributed: number;
      balance: number;
    }[]
  >();
  for (const member of tab.members) {
    totals.set(member.id, { totalSpent: 0, totalContributed: 0, netBalance: 0, expenseCount: 0 });
    lines.set(member.id, []);
  }

  for (const expense of currencyExpenses) {
    const split = computeSplit(expense.people, expense.items);
    const rate = activeExchangeRate(expense, tab.defaultCurrency ?? "USD");
    const original = computeSettlement(expense.contributions, split);
    const settlement = rate ? convertSettlement(original, split.grandTotal, rate.rate) : original;
    for (const row of settlement) {
      const link = expense.tabMemberIds?.find((l) => l.personId === row.personId);
      if (!link) continue;
      const entry = totals.get(link.memberId);
      if (!entry) continue;
      entry.totalSpent += row.fairShare;
      entry.totalContributed += row.contributed;
      entry.netBalance += row.balance;
      entry.expenseCount += 1;
      lines.get(link.memberId)!.push({
        expenseSlug: expense.slug,
        expenseName: expense.name,
        date: expense.date,
        fairShare: round2(row.fairShare),
        contributed: round2(row.contributed),
        balance: round2(row.balance),
      });
    }
  }

  return {
    expenseCount: currencyExpenses.length,
    convertedExpenseCount: currencyExpenses.filter(expense => activeExchangeRate(expense, tab.defaultCurrency ?? "USD")).length,
    members: await Promise.all(
      tab.members.map(async (member) => {
        const entry = totals.get(member.id)!;
        return {
          memberId: member.id,
          // The identity this member renders as - see MemberAvatar, which
          // keys a person's colour on it so they look the same everywhere.
          resolvedId: member.claimedByUserId ?? member.id,
          name: await resolveMemberName(ctx, member),
          claimed: member.claimedByUserId !== undefined,
          totalSpent: round2(entry.totalSpent),
          totalContributed: round2(entry.totalContributed),
          netBalance: round2(entry.netBalance),
          expenseCount: entry.expenseCount,
          expenses: lines.get(member.id)!.sort((a, b) => b.date.localeCompare(a.date)),
        };
      }),
    ),
  };
}

export const breakdown = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const viewable = await viewableTab(ctx, slug);
    if (!viewable) return null;
    const { tab } = viewable;

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_tab", (q) => q.eq("tabId", tab._id))
      .collect();

    // Group expenses by currency so each currency gets its own independent
    // settlement/breakdown - balances in different currencies can't be
    // netted against each other. A tab with no expenses yet still gets one
    // (empty) "USD" group so the roster shows everyone settled up.
    const byCurrency = new Map<string, Doc<"expenses">[]>();
    for (const expense of expenses) {
      const code = activeExchangeRate(expense, tab.defaultCurrency ?? "USD")?.to ?? expense.currency ?? "USD";
      const list = byCurrency.get(code);
      if (list) list.push(expense);
      else byCurrency.set(code, [expense]);
    }
    if (byCurrency.size === 0) byCurrency.set("USD", []);

    const currencies = await Promise.all(
      Array.from(byCurrency.entries()).map(async ([currency, currencyExpenses]) => ({
        currency,
        ...(await computeCurrencyBreakdown(ctx, tab, currencyExpenses)),
      })),
    );
    currencies.sort((a, b) => b.expenseCount - a.expenseCount || a.currency.localeCompare(b.currency));

    return {
      tab: { name: tab.name, slug: tab.slug },
      expenseCount: expenses.length,
      currencies,
    };
  },
});
