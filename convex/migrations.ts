import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/**
 * Gives every existing seat a `tabMembers` row and re-keys the roster onto
 * those rows' ids.
 *
 * Seats used to be identified by a UUID minted inline, and that UUID is
 * referenced from more than the roster: an expense stores it in
 * `tabMemberIds[].memberId`, and - for an anonymous member, whose resolved
 * identity *is* their seat id - in `people[].id`, each item's `splitWith[]`,
 * and `contributions[].personId`. All of them are rewritten here, in one
 * transaction per run, so no expense is ever left pointing at a seat that no
 * longer exists.
 *
 * A claimed member's person ids are their account id, not their seat id, so
 * they are left alone - the remap only touches ids it actually minted.
 *
 * Idempotent: a tab whose seat ids already resolve to rows is skipped, so
 * this is safe to re-run and safe to run against a partly-migrated database.
 */
export const backfillSeatRows = internalMutation({
  args: {},
  returns: v.object({
    tabsMigrated: v.number(),
    tabsSkipped: v.number(),
    seatsCreated: v.number(),
    expensesRewritten: v.number(),
  }),
  handler: async (ctx) => {
    let tabsMigrated = 0;
    let tabsSkipped = 0;
    let seatsCreated = 0;
    let expensesRewritten = 0;

    for (const tab of await ctx.db.query("tabs").collect()) {
      const alreadyKeyed =
        tab.members.length > 0 &&
        tab.members.every((m) => ctx.db.normalizeId("tabMembers", m.id) !== null);
      if (alreadyKeyed) {
        tabsSkipped += 1;
        continue;
      }

      // Clear any rows from an earlier, differently-keyed attempt so a re-run
      // rebuilds the roster rather than doubling it.
      for (const stale of await ctx.db
        .query("tabMembers")
        .withIndex("by_tab", (q) => q.eq("tabId", tab._id))
        .collect()) {
        await ctx.db.delete(stale._id);
      }

      const remap = new Map<string, string>();
      const members = [];
      for (const member of tab.members) {
        const id = await ctx.db.insert("tabMembers", {
          tabId: tab._id,
          name: member.name,
          inviteToken: member.inviteToken,
          userId: member.claimedByUserId,
        });
        remap.set(member.id, id);
        members.push({ ...member, id });
        seatsCreated += 1;
      }
      await ctx.db.patch(tab._id, { members });
      tabsMigrated += 1;

      const remapId = (id: string) => remap.get(id) ?? id;
      for (const expense of await ctx.db
        .query("expenses")
        .withIndex("by_tab", (q) => q.eq("tabId", tab._id))
        .collect()) {
        await ctx.db.patch(expense._id, {
          people: expense.people.map((p) => ({ ...p, id: remapId(p.id) })),
          items: expense.items.map((i) => ({ ...i, splitWith: i.splitWith.map(remapId) })),
          contributions: expense.contributions.map((c) => ({ ...c, personId: remapId(c.personId) })),
          tabMemberIds: expense.tabMemberIds?.map((l) => ({
            personId: remapId(l.personId),
            memberId: remapId(l.memberId),
          })),
        });
        expensesRewritten += 1;
      }
    }

    return { tabsMigrated, tabsSkipped, seatsCreated, expensesRewritten };
  },
});
