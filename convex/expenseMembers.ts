import type { Doc } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx } from "./_generated/server";

/** Expense participants come from the current tab roster, using stable seat IDs. */
export async function resolveExpenseMembers(ctx: QueryCtx | MutationCtx, expense: Doc<"expenses">) {
  // Every expense belongs to a tab: `tabs.createExpense` is the only insert
  // path and always sets `tabId`, and `expenses.save` refuses a doc without
  // one. The field stays optional for the type, so this keeps an empty roster
  // rather than asserting - a tab-less doc would have had no roster to read
  // anyway now that the legacy `people` snapshot is gone.
  if (!expense.tabId) return { ...expense, people: [] };
  const seats = await ctx.db.query("tabMembers").withIndex("by_tab", q => q.eq("tabId", expense.tabId!)).collect();
  const people = await Promise.all(seats.map(async seat => {
    const user = seat.userId ? await ctx.db.get(seat.userId) : null;
    return { id: seat._id as string, name: user?.name?.trim() || user?.email?.trim() || seat.name };
  }));
  const order = expense.roundingOrder ?? [];
  const priority = new Map<string, number>(order.map((memberId, index) => [memberId, index]));
  people.sort((a, b) => (priority.get(a.id) ?? order.length) - (priority.get(b.id) ?? order.length));
  return {
    ...expense, people,
  };
}

/** Reject foreign/missing members, even if a caller fabricates the UI payload. */
export async function assertExpenseMembers(ctx: QueryCtx | MutationCtx, expense: {
  tabId?: Doc<"expenses">["tabId"];
  items: Doc<"expenses">["items"];
}) {
  if (!expense.tabId) throw new Error("Expense must belong to a tab");
  const seats = await ctx.db.query("tabMembers").withIndex("by_tab", q => q.eq("tabId", expense.tabId!)).collect();
  const ids = new Set<string>(seats.map(seat => seat._id));
  for (const id of expense.items.flatMap(item => item.splitWith)) {
    if (!ids.has(id)) throw new Error("Split and payment participants must belong to this tab");
  }
}
