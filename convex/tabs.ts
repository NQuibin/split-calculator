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
 * Creates a seat row. The row's `_id` is the seat id, so the row has to exist
 * before anything can point at it - which is why every path that adds a
 * member goes through here rather than minting an id of its own.
 */
async function createSeat(
  ctx: MutationCtx,
  tabId: Id<"tabs">,
  name: string,
  userId?: Id<"users">,
): Promise<Seat> {
  const id = await ctx.db.insert("tabMembers", { tabId, name, inviteToken: crypto.randomUUID(), userId });
  return (await ctx.db.get(id))!;
}

export type Seat = Doc<"tabMembers">;

/**
 * A tab's roster, oldest seat first. `by_tab` is ordered by creation time, so
 * this preserves the order the roster was built in - the creator, then
 * everyone added since.
 */
export async function tabSeats(ctx: QueryCtx | MutationCtx, tabId: Id<"tabs">): Promise<Seat[]> {
  return await ctx.db
    .query("tabMembers")
    .withIndex("by_tab", (q) => q.eq("tabId", tabId))
    .collect();
}

function requireUniqueName(seats: Seat[], name: string, excludeId?: string) {
  const normalized = normalizeMemberName(name);
  const collision = seats.some((s) => s._id !== excludeId && normalizeMemberName(s.name) === normalized);
  if (collision) throw new Error(`"${name.trim()}" is already in this tab`);
}

async function getDisplayName(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  return user?.name?.trim() || user?.email?.trim() || "You";
}

// A claimed seat shows its account's current name (falling back to email)
// rather than the name frozen in when they were added or claimed - so a later
// Settings rename is reflected everywhere they appear.
export async function resolveSeatName(ctx: QueryCtx | MutationCtx, seat: Seat) {
  if (!seat.userId) return seat.name;
  const user = await ctx.db.get(seat.userId);
  return user?.name?.trim() || user?.email?.trim() || seat.name;
}

// Every tab the user belongs to. One indexed query now that the owner holds a
// seat like everyone else - `create` always seats them and `removeMember`
// refuses to remove them, so ownership needs no separate lookup. Deduped
// because nothing in the schema forbids a user holding two seats in a tab.
export async function listTabsForUser(ctx: QueryCtx, userId: Id<"users">) {
  const seats = await ctx.db
    .query("tabMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  const byId = new Map<string, Doc<"tabs">>();
  for (const tab of await Promise.all(seats.map((s) => ctx.db.get(s.tabId)))) {
    if (tab) byId.set(tab._id, tab);
  }
  return Array.from(byId.values());
}

async function resolveMembers(ctx: QueryCtx, tab: Doc<"tabs">) {
  const seats = await tabSeats(ctx, tab._id);
  return await Promise.all(
    seats.map(async (seat) => ({
      id: seat._id,
      name: await resolveSeatName(ctx, seat),
      claimed: seat.userId !== undefined,
      // The identity a person gets remapped to once assigned to this tab
      // (see createExpense) - lets a brand-new expense started from this
      // tab already carry a claimed member's real account id, instead of
      // only picking it up once explicitly assigned.
      resolvedId: seat.userId ?? seat._id,
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

    const tabId = await ctx.db.insert("tabs", {
      slug,
      ownerUserId: userId,
      name: trimmedName,
      defaultCurrency: creator?.defaultCurrency ?? "USD",
      updatedAt: Date.now(),
    });

    // The creator is seated first, so `by_tab`'s creation-time order puts
    // them at the head of the roster.
    await createSeat(ctx, tabId, creatorName, userId);
    for (const memberName of trimmedMemberNames) {
      await createSeat(ctx, tabId, memberName);
    }
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

    for (const seat of await tabSeats(ctx, tab._id)) {
      await ctx.db.delete(seat._id);
    }

    await ctx.db.delete(tab._id);
  },
});

export const addMember = mutation({
  args: { slug: v.string(), name: v.string() },
  handler: async (ctx, { slug, name }) => {
    const { tab } = await ownedTab(ctx, slug);

    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("Member name is required");
    const seats = await tabSeats(ctx, tab._id);
    requireUniqueName(seats, trimmedName);

    await createSeat(ctx, tab._id, trimmedName);
    await ctx.db.patch(tab._id, { updatedAt: Date.now() });
  },
});

export const renameMember = mutation({
  args: { slug: v.string(), memberId: v.string(), name: v.string() },
  handler: async (ctx, { slug, memberId, name }) => {
    const { tab } = await ownedTab(ctx, slug);

    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("Member name is required");
    const seats = await tabSeats(ctx, tab._id);
    const seat = seats.find((s) => s._id === memberId);
    if (!seat) throw new Error("Member not found");
    requireUniqueName(seats, trimmedName, memberId);

    await ctx.db.patch(seat._id, { name: trimmedName });
    await ctx.db.patch(tab._id, { updatedAt: Date.now() });
  },
});

export const removeMember = mutation({
  args: { slug: v.string(), memberId: v.string() },
  handler: async (ctx, { slug, memberId }) => {
    const { tab } = await ownedTab(ctx, slug);

    const seats = await tabSeats(ctx, tab._id);
    const removed = seats.find((s) => s._id === memberId);
    if (!removed) throw new Error("Member not found");
    if (removed.userId === tab.ownerUserId) {
      throw new Error("The tab creator can't be removed");
    }

    await ctx.db.delete(removed._id);
    await ctx.db.patch(tab._id, { updatedAt: Date.now() });
  },
});

export const claimMember = mutation({
  args: { slug: v.string(), token: v.string() },
  handler: async (ctx, { slug, token }) => {
    const userId = await requireUserId(ctx);
    const tab = await getTabBySlug(ctx, slug);
    if (!tab) throw new Error("Tab not found");

    const seats = await tabSeats(ctx, tab._id);
    const seat = seats.find((s) => s.inviteToken === token);
    if (!seat) throw new Error("Invalid invite link");
    if (seat.userId === userId) return;
    if (tab.ownerUserId === userId) {
      throw new Error("You created this tab, so you're already a member");
    }
    if (seat.userId) throw new Error("This spot has already been claimed");
    if (seats.some((s) => s.userId === userId)) {
      throw new Error("You're already a member of this tab");
    }

    await ctx.db.patch(seat._id, { userId });
    await ctx.db.patch(tab._id, { updatedAt: Date.now() });

  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await Promise.all(
      (await listTabsForUser(ctx, userId)).map(async (t) => ({
        slug: t.slug,
        name: t.name,
        isOwner: t.ownerUserId === userId,
        memberCount: (await tabSeats(ctx, t._id)).length,
      })),
    );
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

      const members = await resolveMembers(ctx, tab);
      return {
        slug: tab.slug,
        name: tab.name,
        isOwner: tab.ownerUserId === userId,
        memberCount: members.length,
        defaultCurrency: tab.defaultCurrency ?? "USD",
        members,
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

    if (!(await isInviteToken(ctx, tab, token))) await requireTabViewer(ctx, tab);
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

    return (await tabSeats(ctx, tab._id))
      .filter((seat) => !seat.userId)
      .map((seat) => ({ memberId: seat._id, name: seat.name, token: seat.inviteToken }));
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

    const existingSeats = await tabSeats(ctx, tab._id);
    let seats = existingSeats;
    const links: { personId: string; memberId: string }[] = [];
    const usedMemberIds = new Set<string>();

    for (const entry of memberMapping) {
      if (entry.memberId) {
        if (!seats.some((s) => s._id === entry.memberId)) throw new Error("Member not found");
        if (usedMemberIds.has(entry.memberId)) throw new Error("Two people can't map to the same tab member");
        usedMemberIds.add(entry.memberId);
        links.push({ personId: entry.personId, memberId: entry.memberId });
        continue;
      }
      const newMemberName = entry.newMemberName?.trim();
      if (!newMemberName) throw new Error("Each person needs a member to map to");
      requireUniqueName(seats, newMemberName);
      const newSeat = await createSeat(ctx, tab._id, newMemberName);
      seats = [...seats, newSeat];
      links.push({ personId: entry.personId, memberId: newSeat._id });
    }

    if (seats !== existingSeats) {
      await ctx.db.patch(tab._id, { updatedAt: Date.now() });
    }

    // Re-point each mapped person at their tab member's stable identity -
    // the claiming user's id when claimed, otherwise the member's own id -
    // and rename them to match, so the expense (people, item splits, and
    // contributions) is fully owned by the mapping just decided instead of
    // carrying whatever ids/names it had before joining the tab.
    const seatsById = new Map<string, Seat>(seats.map((s) => [s._id, s]));
    const idRemap = new Map<string, string>();
    const nameByNewId = new Map<string, string>();
    for (const link of links) {
      const seat = seatsById.get(link.memberId);
      if (!seat) continue;
      const newId = seat.userId ?? seat._id;
      idRemap.set(link.personId, newId);
      nameByNewId.set(newId, await resolveSeatName(ctx, seat));
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
    const seats = await tabSeats(ctx, tab._id);
    let seat: Seat;

    if (memberId) {
      const found = seats.find((s) => s._id === memberId);
      if (!found) throw new Error("Member not found");
      if (linkedMemberIds.has(memberId)) throw new Error("This member is already on the expense");
      seat = found;
    } else {
      const trimmedName = newMemberName?.trim();
      if (!trimmedName) throw new Error("Name is required");
      requireUniqueName(seats, trimmedName);
      seat = await createSeat(ctx, tab._id, trimmedName);
      await ctx.db.patch(tab._id, { updatedAt: Date.now() });
    }

    const personId = seat.userId ?? seat._id;
    const name = await resolveSeatName(ctx, seat);

    await ctx.db.patch(expense._id, {
      people: [...expense.people, { id: personId, name }],
      tabMemberIds: [...(expense.tabMemberIds ?? []), { personId, memberId: seat._id }],
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
  seats: Seat[],
  currencyExpenses: Doc<"expenses">[],
  defaultCurrency: string,
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
  for (const seat of seats) {
    totals.set(seat._id, { totalSpent: 0, totalContributed: 0, netBalance: 0, expenseCount: 0 });
    lines.set(seat._id, []);
  }

  for (const expense of currencyExpenses) {
    const split = computeSplit(expense.people, expense.items);
    const rate = activeExchangeRate(expense, defaultCurrency);
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
    convertedExpenseCount: currencyExpenses.filter(expense => activeExchangeRate(expense, defaultCurrency)).length,
    members: await Promise.all(
      seats.map(async (seat) => {
        const entry = totals.get(seat._id)!;
        return {
          memberId: seat._id,
          // The identity this member renders as - see MemberAvatar, which
          // keys a person's colour on it so they look the same everywhere.
          resolvedId: seat.userId ?? seat._id,
          name: await resolveSeatName(ctx, seat),
          claimed: seat.userId !== undefined,
          totalSpent: round2(entry.totalSpent),
          totalContributed: round2(entry.totalContributed),
          netBalance: round2(entry.netBalance),
          expenseCount: entry.expenseCount,
          expenses: lines.get(seat._id)!.sort((a, b) => b.date.localeCompare(a.date)),
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

    // Read once and share across the currency groups - each group covers the
    // same roster, so re-reading it per currency would be pure waste.
    const seats = await tabSeats(ctx, tab._id);
    const currencies = await Promise.all(
      Array.from(byCurrency.entries()).map(async ([currency, currencyExpenses]) => ({
        currency,
        ...(await computeCurrencyBreakdown(ctx, seats, currencyExpenses, tab.defaultCurrency ?? "USD")),
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
