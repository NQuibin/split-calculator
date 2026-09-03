import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { computeSettlement, computeSplit, round2 } from "../src/lib/calculations";
import { normalizeMemberName } from "../src/lib/groupMembers";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

async function getGroupBySlug(ctx: QueryCtx | MutationCtx, slug: string) {
  return await ctx.db
    .query("groups")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
}

function requireUniqueName(members: Doc<"groups">["members"], name: string, excludeId?: string) {
  const normalized = normalizeMemberName(name);
  const collision = members.some((m) => m.id !== excludeId && normalizeMemberName(m.name) === normalized);
  if (collision) throw new Error(`"${name.trim()}" is already in this group`);
}

async function getDisplayName(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  return user?.name?.trim() || user?.email?.trim() || "You";
}

// Claimed members show their account's current name (falling back to email)
// rather than the name frozen into the member row when they were added or
// claimed - so a later Settings rename is reflected everywhere they appear.
async function resolveMemberName(ctx: QueryCtx | MutationCtx, member: Doc<"groups">["members"][number]) {
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
    if (!trimmedName) throw new Error("Group name is required");

    // The creator is always the group's first member - a group can't exist
    // without at least the person who made it.
    const creatorName = await getDisplayName(ctx, userId);

    const trimmedMemberNames = memberNames.map((n) => n.trim()).filter((n) => n.length > 0);

    const seen = new Set<string>([normalizeMemberName(creatorName)]);
    for (const memberName of trimmedMemberNames) {
      const normalized = normalizeMemberName(memberName);
      if (seen.has(normalized)) throw new Error(`"${memberName}" is listed more than once`);
      seen.add(normalized);
    }

    const existing = await getGroupBySlug(ctx, slug);
    if (existing) throw new Error("Slug already taken");

    const members = [
      { id: crypto.randomUUID(), name: creatorName, claimedByUserId: userId, inviteToken: crypto.randomUUID() },
      ...trimmedMemberNames.map((memberName) => ({
        id: crypto.randomUUID(),
        name: memberName,
        inviteToken: crypto.randomUUID(),
      })),
    ];

    await ctx.db.insert("groups", {
      slug,
      ownerUserId: userId,
      name: trimmedName,
      members,
      updatedAt: Date.now(),
    });
  },
});

export const rename = mutation({
  args: { slug: v.string(), name: v.string() },
  handler: async (ctx, { slug, name }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const group = await getGroupBySlug(ctx, slug);
    if (!group) throw new Error("Group not found");
    if (group.ownerUserId !== userId) throw new Error("Not authorized");

    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("Group name is required");
    await ctx.db.patch(group._id, { name: trimmedName, updatedAt: Date.now() });
  },
});

export const deleteGroup = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const group = await getGroupBySlug(ctx, slug);
    if (!group) throw new Error("Group not found");
    if (group.ownerUserId !== userId) throw new Error("Not authorized");

    // Unlink (not delete) the group's receipts - they still belong to
    // whoever owns them, just no longer attached to this group.
    const receipts = await ctx.db
      .query("receipts")
      .withIndex("by_group", (q) => q.eq("groupId", group._id))
      .collect();
    for (const receipt of receipts) {
      await ctx.db.patch(receipt._id, { groupId: undefined, groupMemberIds: undefined });
    }

    for (const member of group.members) {
      if (!member.claimedByUserId) continue;
      const memberships = await ctx.db
        .query("groupMemberships")
        .withIndex("by_user", (q) => q.eq("userId", member.claimedByUserId!))
        .collect();
      const stale = memberships.find((m) => m.groupId === group._id);
      if (stale) await ctx.db.delete(stale._id);
    }

    await ctx.db.delete(group._id);
  },
});

export const addMember = mutation({
  args: { slug: v.string(), name: v.string() },
  handler: async (ctx, { slug, name }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const group = await getGroupBySlug(ctx, slug);
    if (!group) throw new Error("Group not found");
    if (group.ownerUserId !== userId) throw new Error("Not authorized");

    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("Member name is required");
    requireUniqueName(group.members, trimmedName);

    const members = [...group.members, { id: crypto.randomUUID(), name: trimmedName, inviteToken: crypto.randomUUID() }];
    await ctx.db.patch(group._id, { members, updatedAt: Date.now() });
  },
});

export const renameMember = mutation({
  args: { slug: v.string(), memberId: v.string(), name: v.string() },
  handler: async (ctx, { slug, memberId, name }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const group = await getGroupBySlug(ctx, slug);
    if (!group) throw new Error("Group not found");
    if (group.ownerUserId !== userId) throw new Error("Not authorized");

    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("Member name is required");
    if (!group.members.some((m) => m.id === memberId)) throw new Error("Member not found");
    requireUniqueName(group.members, trimmedName, memberId);

    const members = group.members.map((m) => (m.id === memberId ? { ...m, name: trimmedName } : m));
    await ctx.db.patch(group._id, { members, updatedAt: Date.now() });
  },
});

export const removeMember = mutation({
  args: { slug: v.string(), memberId: v.string() },
  handler: async (ctx, { slug, memberId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const group = await getGroupBySlug(ctx, slug);
    if (!group) throw new Error("Group not found");
    if (group.ownerUserId !== userId) throw new Error("Not authorized");

    const removed = group.members.find((m) => m.id === memberId);
    if (!removed) throw new Error("Member not found");
    if (removed.claimedByUserId === group.ownerUserId) {
      throw new Error("The group creator can't be removed");
    }

    const members = group.members.filter((m) => m.id !== memberId);
    await ctx.db.patch(group._id, { members, updatedAt: Date.now() });

    // If the removed slot was that user's only claimed slot in this group, drop
    // the membership row too, so a removed member's account stops seeing this
    // group in their own "My Groups" list.
    if (removed?.claimedByUserId) {
      const stillClaims = members.some((m) => m.claimedByUserId === removed.claimedByUserId);
      if (!stillClaims) {
        const memberships = await ctx.db
          .query("groupMemberships")
          .withIndex("by_user", (q) => q.eq("userId", removed.claimedByUserId!))
          .collect();
        const stale = memberships.find((m) => m.groupId === group._id);
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
    const group = await getGroupBySlug(ctx, slug);
    if (!group) throw new Error("Group not found");

    const member = group.members.find((m) => m.inviteToken === token);
    if (!member) throw new Error("Invalid invite link");
    if (member.claimedByUserId === userId) return;
    if (group.ownerUserId === userId) {
      throw new Error("You created this group, so you're already a member");
    }
    if (member.claimedByUserId) throw new Error("This spot has already been claimed");
    if (group.members.some((m) => m.claimedByUserId === userId)) {
      throw new Error("You're already a member of this group");
    }

    const members = group.members.map((m) => (m.id === member.id ? { ...m, claimedByUserId: userId } : m));
    await ctx.db.patch(group._id, { members, updatedAt: Date.now() });

    const existingMembership = await ctx.db
      .query("groupMemberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (!existingMembership.some((m) => m.groupId === group._id)) {
      await ctx.db.insert("groupMemberships", { userId, groupId: group._id });
    }
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const owned = await ctx.db
      .query("groups")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", userId))
      .collect();

    const memberships = await ctx.db
      .query("groupMemberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const claimedGroups = (
      await Promise.all(memberships.map((m) => ctx.db.get(m.groupId)))
    ).filter((g): g is Doc<"groups"> => g !== null);

    const byId = new Map<string, Doc<"groups">>();
    for (const g of [...owned, ...claimedGroups]) byId.set(g._id, g);

    return Array.from(byId.values()).map((g) => ({
      slug: g.slug,
      name: g.name,
      isOwner: g.ownerUserId === userId,
      memberCount: g.members.length,
    }));
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const group = await getGroupBySlug(ctx, slug);
    if (!group) return null;
    const userId = await getAuthUserId(ctx);
    const members = await Promise.all(
      group.members.map(async (m) => ({
        id: m.id,
        name: await resolveMemberName(ctx, m),
        claimed: m.claimedByUserId !== undefined,
      })),
    );
    return {
      slug: group.slug,
      name: group.name,
      isOwner: userId !== null && group.ownerUserId === userId,
      members,
    };
  },
});

export const getInviteLinks = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const group = await getGroupBySlug(ctx, slug);
    if (!group) throw new Error("Group not found");
    if (group.ownerUserId !== userId) throw new Error("Not authorized");

    return group.members
      .filter((m) => !m.claimedByUserId)
      .map((m) => ({ memberId: m.id, name: m.name, token: m.inviteToken }));
  },
});

export const assignReceipt = mutation({
  args: {
    groupSlug: v.string(),
    receiptSlug: v.string(),
    memberMapping: v.array(
      v.object({
        personId: v.string(),
        memberId: v.optional(v.string()),
        newMemberName: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { groupSlug, receiptSlug, memberMapping }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    const group = await getGroupBySlug(ctx, groupSlug);
    if (!group) throw new Error("Group not found");
    if (group.ownerUserId !== userId) throw new Error("Not authorized");

    const receipt = await ctx.db
      .query("receipts")
      .withIndex("by_user_slug", (q) => q.eq("userId", userId).eq("slug", receiptSlug))
      .unique();
    if (!receipt) throw new Error("Receipt not found");

    let members = group.members;
    const links: { personId: string; memberId: string }[] = [];
    const usedMemberIds = new Set<string>();

    for (const entry of memberMapping) {
      if (entry.memberId) {
        if (!members.some((m) => m.id === entry.memberId)) throw new Error("Member not found");
        if (usedMemberIds.has(entry.memberId)) throw new Error("Two people can't map to the same group member");
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

    if (members !== group.members) {
      await ctx.db.patch(group._id, { members, updatedAt: Date.now() });
    }

    // Re-point each mapped person at their group member's stable identity -
    // the claiming user's id when claimed, otherwise the member's own id -
    // and rename them to match, so the receipt (people, item splits, and
    // contributions) is fully owned by the mapping just decided instead of
    // carrying whatever ids/names it had before joining the group.
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

    const people = receipt.people.map((person) => {
      const id = remapId(person.id);
      return { id, name: nameByNewId.get(id) ?? person.name };
    });
    const items = receipt.items.map((item) => ({ ...item, splitWith: item.splitWith.map(remapId) }));
    const contributions = receipt.contributions.map((c) => ({ ...c, personId: remapId(c.personId) }));
    const groupMemberIds = links.map((link) => ({ personId: remapId(link.personId), memberId: link.memberId }));

    await ctx.db.patch(receipt._id, { groupId: group._id, groupMemberIds, people, items, contributions });
  },
});

export const unassignReceipt = mutation({
  args: { receiptSlug: v.string() },
  handler: async (ctx, { receiptSlug }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const receipt = await ctx.db
      .query("receipts")
      .withIndex("by_user_slug", (q) => q.eq("userId", userId).eq("slug", receiptSlug))
      .unique();
    if (!receipt) throw new Error("Receipt not found");
    await ctx.db.patch(receipt._id, { groupId: undefined, groupMemberIds: undefined });
  },
});

export const receiptsForGroup = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const group = await getGroupBySlug(ctx, slug);
    if (!group) return [];
    const receipts = await ctx.db
      .query("receipts")
      .withIndex("by_group", (q) => q.eq("groupId", group._id))
      .collect();
    return receipts
      .map(({ slug, name, people, items, tax, tip, updatedAt }) => ({ slug, name, people, items, tax, tip, updatedAt }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const breakdown = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const group = await getGroupBySlug(ctx, slug);
    if (!group) return null;

    const receipts = await ctx.db
      .query("receipts")
      .withIndex("by_group", (q) => q.eq("groupId", group._id))
      .collect();

    const totals = new Map<
      string,
      { totalSpent: number; totalContributed: number; netBalance: number; receiptCount: number }
    >();
    for (const member of group.members) {
      totals.set(member.id, { totalSpent: 0, totalContributed: 0, netBalance: 0, receiptCount: 0 });
    }

    for (const receipt of receipts) {
      const split = computeSplit(receipt.people, receipt.items, receipt.tax, receipt.tip);
      const settlement = computeSettlement(receipt.contributions, split);
      for (const row of settlement) {
        const link = receipt.groupMemberIds?.find((l) => l.personId === row.personId);
        if (!link) continue;
        const entry = totals.get(link.memberId);
        if (!entry) continue;
        entry.totalSpent += row.fairShare;
        entry.totalContributed += row.contributed;
        entry.netBalance += row.balance;
        entry.receiptCount += 1;
      }
    }

    return {
      group: { name: group.name, slug: group.slug },
      receiptCount: receipts.length,
      members: await Promise.all(
        group.members.map(async (member) => {
          const entry = totals.get(member.id)!;
          return {
            memberId: member.id,
            name: await resolveMemberName(ctx, member),
            claimed: member.claimedByUserId !== undefined,
            totalSpent: round2(entry.totalSpent),
            totalContributed: round2(entry.totalContributed),
            netBalance: round2(entry.netBalance),
            receiptCount: entry.receiptCount,
          };
        }),
      ),
    };
  },
});
