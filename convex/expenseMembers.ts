import type { Doc } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx } from "./_generated/server";

/** Legacy rows are translated on read until they are migrated or next saved. */
export async function resolveExpenseMembers(ctx: QueryCtx | MutationCtx, expense: Doc<"expenses">) {
  if (!expense.tabId) return { ...expense, people: expense.people ?? [] };
  const seats = await ctx.db.query("tabMembers").withIndex("by_tab", q => q.eq("tabId", expense.tabId!)).collect();
  const remap = new Map((expense.tabMemberIds ?? []).map(link => [link.personId, link.memberId]));
  const id = (value: string) => expense.memberReferencesVersion === 1 ? value :
    remap.get(value) ?? seats.find(seat => seat._id === value || seat.userId === value)?._id ?? value;
  const people = await Promise.all(seats.map(async seat => {
    const user = seat.userId ? await ctx.db.get(seat.userId) : null;
    return { id: seat._id as string, name: user?.name?.trim() || user?.email?.trim() || seat.name };
  }));
  // Keep historical references visible if an old version removed a used seat.
  for (const person of expense.people ?? []) {
    if (!people.some(p => p.id === id(person.id))) people.push({ ...person, id: id(person.id) });
  }
  const order = expense.roundingOrder ?? expense.people?.map(person => id(person.id)) ?? [];
  const priority = new Map<string, number>(order.map((memberId, index) => [memberId, index]));
  people.sort((a, b) => (priority.get(a.id) ?? order.length) - (priority.get(b.id) ?? order.length));
  return {
    ...expense, people,
    items: expense.items.map(item => ({ ...item, splitWith: item.splitWith.map(id) })),
    contributions: expense.contributions.map(payment => ({ ...payment, personId: id(payment.personId) })),
  };
}

/** Reject foreign/missing members, even if a caller fabricates the UI payload. */
export async function assertExpenseMembers(ctx: QueryCtx | MutationCtx, expense: {
  tabId?: Doc<"expenses">["tabId"];
  items: Doc<"expenses">["items"];
  contributions: Doc<"expenses">["contributions"];
}) {
  if (!expense.tabId) throw new Error("Expense must belong to a tab");
  const seats = await ctx.db.query("tabMembers").withIndex("by_tab", q => q.eq("tabId", expense.tabId!)).collect();
  const ids = new Set<string>(seats.map(seat => seat._id));
  for (const id of [...expense.items.flatMap(item => item.splitWith), ...expense.contributions.map(c => c.personId)]) {
    if (!ids.has(id)) throw new Error("Split and payment participants must belong to this tab");
  }
}
