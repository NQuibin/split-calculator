import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { computeSettlement, computeSplit, round2 } from "../src/lib/calculations";
import { normalizeMemberName } from "../src/lib/tabMembers";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

async function getTabBySlug(ctx: QueryCtx | MutationCtx, slug: string) {
  return await ctx.db
    .query("tabs")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
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

export const create = mutation({
  args: { slug: v.string(), name: v.string(), memberNames: v.array(v.string()) },
  handler: async (ctx, { slug, name, memberNames }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");

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

    await ctx.db.insert("tabs", {
      slug,
      ownerUserId: userId,
      name: trimmedName,
      members,
      defaultCurrency: creator?.defaultCurrency ?? "USD",
      updatedAt: Date.now(),
    });
  },
});

export const rename = mutation({
  args: { slug: v.string(), name: v.string() },
  handler: async (ctx, { slug, name }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const tab = await getTabBySlug(ctx, slug);
    if (!tab) throw new Error("Tab not found");
    if (tab.ownerUserId !== userId) throw new Error("Not authorized");

    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("Tab name is required");
    await ctx.db.patch(tab._id, { name: trimmedName, updatedAt: Date.now() });
  },
});

export const setDefaultCurrency = mutation({
  args: { slug: v.string(), currency: v.string() },
  handler: async (ctx, { slug, currency }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const tab = await getTabBySlug(ctx, slug);
    if (!tab) throw new Error("Tab not found");
    if (tab.ownerUserId !== userId) throw new Error("Not authorized");

    await ctx.db.patch(tab._id, { defaultCurrency: currency, updatedAt: Date.now() });
  },
});

export const deleteTab = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const tab = await getTabBySlug(ctx, slug);
    if (!tab) throw new Error("Tab not found");
    if (tab.ownerUserId !== userId) throw new Error("Not authorized");

    // Unlink (not delete) the tab's expenses - they still belong to
    // whoever owns them, just no longer attached to this tab.
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_tab", (q) => q.eq("tabId", tab._id))
      .collect();
    for (const expense of expenses) {
      await ctx.db.patch(expense._id, { tabId: undefined, tabMemberIds: undefined });
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

    await ctx.db.delete(tab._id);
  },
});

export const addMember = mutation({
  args: { slug: v.string(), name: v.string() },
  handler: async (ctx, { slug, name }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const tab = await getTabBySlug(ctx, slug);
    if (!tab) throw new Error("Tab not found");
    if (tab.ownerUserId !== userId) throw new Error("Not authorized");

    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("Member name is required");
    requireUniqueName(tab.members, trimmedName);

    const members = [...tab.members, { id: crypto.randomUUID(), name: trimmedName, inviteToken: crypto.randomUUID() }];
    await ctx.db.patch(tab._id, { members, updatedAt: Date.now() });
  },
});

export const renameMember = mutation({
  args: { slug: v.string(), memberId: v.string(), name: v.string() },
  handler: async (ctx, { slug, memberId, name }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const tab = await getTabBySlug(ctx, slug);
    if (!tab) throw new Error("Tab not found");
    if (tab.ownerUserId !== userId) throw new Error("Not authorized");

    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("Member name is required");
    if (!tab.members.some((m) => m.id === memberId)) throw new Error("Member not found");
    requireUniqueName(tab.members, trimmedName, memberId);

    const members = tab.members.map((m) => (m.id === memberId ? { ...m, name: trimmedName } : m));
    await ctx.db.patch(tab._id, { members, updatedAt: Date.now() });
  },
});

export const removeMember = mutation({
  args: { slug: v.string(), memberId: v.string() },
  handler: async (ctx, { slug, memberId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const tab = await getTabBySlug(ctx, slug);
    if (!tab) throw new Error("Tab not found");
    if (tab.ownerUserId !== userId) throw new Error("Not authorized");

    const removed = tab.members.find((m) => m.id === memberId);
    if (!removed) throw new Error("Member not found");
    if (removed.claimedByUserId === tab.ownerUserId) {
      throw new Error("The tab creator can't be removed");
    }

    const members = tab.members.filter((m) => m.id !== memberId);
    await ctx.db.patch(tab._id, { members, updatedAt: Date.now() });

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
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
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

    return Array.from(byId.values()).map((t) => ({
      slug: t.slug,
      name: t.name,
      isOwner: t.ownerUserId === userId,
      memberCount: t.members.length,
    }));
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const tab = await getTabBySlug(ctx, slug);
    if (!tab) return null;
    const userId = await getAuthUserId(ctx);
    const members = await Promise.all(
      tab.members.map(async (m) => ({
        id: m.id,
        name: await resolveMemberName(ctx, m),
        claimed: m.claimedByUserId !== undefined,
        // The identity a person gets remapped to once assigned to this tab
        // (see assignExpense) - lets a brand-new expense started from this
        // tab already carry a claimed member's real account id, instead of
        // only picking it up once explicitly assigned.
        resolvedId: m.claimedByUserId ?? m.id,
      })),
    );
    return {
      slug: tab.slug,
      name: tab.name,
      isOwner: userId !== null && tab.ownerUserId === userId,
      members,
      defaultCurrency: tab.defaultCurrency ?? "USD",
    };
  },
});

export const getInviteLinks = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const tab = await getTabBySlug(ctx, slug);
    if (!tab) throw new Error("Tab not found");
    if (tab.ownerUserId !== userId) throw new Error("Not authorized");

    return tab.members
      .filter((m) => !m.claimedByUserId)
      .map((m) => ({ memberId: m.id, name: m.name, token: m.inviteToken }));
  },
});

export const assignExpense = mutation({
  args: {
    tabSlug: v.string(),
    expenseSlug: v.string(),
    memberMapping: v.array(
      v.object({
        personId: v.string(),
        memberId: v.optional(v.string()),
        newMemberName: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { tabSlug, expenseSlug, memberMapping }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    const tab = await getTabBySlug(ctx, tabSlug);
    if (!tab) throw new Error("Tab not found");
    if (tab.ownerUserId !== userId) throw new Error("Not authorized");

    const expense = await ctx.db
      .query("expenses")
      .withIndex("by_user_slug", (q) => q.eq("userId", userId).eq("slug", expenseSlug))
      .unique();
    if (!expense) throw new Error("Expense not found");

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

    await ctx.db.patch(expense._id, { tabId: tab._id, tabMemberIds, people, items, contributions });
  },
});

// Once an expense belongs to a tab, its existing people are locked to the
// tab mapping decided in assignExpense - the only way to change who's on
// the expense is to add someone, either an existing member not yet on this
// expense or a brand-new one (who is added to the tab at the same time).
export const addExpensePerson = mutation({
  args: {
    expenseSlug: v.string(),
    memberId: v.optional(v.string()),
    newMemberName: v.optional(v.string()),
  },
  handler: async (ctx, { expenseSlug, memberId, newMemberName }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    const expense = await ctx.db
      .query("expenses")
      .withIndex("by_user_slug", (q) => q.eq("userId", userId).eq("slug", expenseSlug))
      .unique();
    if (!expense) throw new Error("Expense not found");
    if (!expense.tabId) throw new Error("Expense is not in a tab");

    const tab = await ctx.db.get(expense.tabId);
    if (!tab) throw new Error("Tab not found");
    if (tab.ownerUserId !== userId) throw new Error("Not authorized");

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
    }

    const personId = member.claimedByUserId ?? member.id;
    const name = await resolveMemberName(ctx, member);

    await ctx.db.patch(expense._id, {
      people: [...expense.people, { id: personId, name }],
      tabMemberIds: [...(expense.tabMemberIds ?? []), { personId, memberId: member.id }],
    });
  },
});

export const unassignExpense = mutation({
  args: { expenseSlug: v.string() },
  handler: async (ctx, { expenseSlug }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const expense = await ctx.db
      .query("expenses")
      .withIndex("by_user_slug", (q) => q.eq("userId", userId).eq("slug", expenseSlug))
      .unique();
    if (!expense) throw new Error("Expense not found");
    await ctx.db.patch(expense._id, { tabId: undefined, tabMemberIds: undefined });
  },
});

export const expensesForTab = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const tab = await getTabBySlug(ctx, slug);
    if (!tab) return [];
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_tab", (q) => q.eq("tabId", tab._id))
      .collect();
    return expenses
      .map(({ slug, name, people, items, currency, updatedAt }) => ({
        slug,
        name,
        people,
        items,
        currency: currency ?? "USD",
        updatedAt,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
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
    const settlement = computeSettlement(expense.contributions, split);
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
    members: await Promise.all(
      tab.members.map(async (member) => {
        const entry = totals.get(member.id)!;
        return {
          memberId: member.id,
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
    const tab = await getTabBySlug(ctx, slug);
    if (!tab) return null;

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
      const code = expense.currency ?? "USD";
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
