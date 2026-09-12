import type { Doc } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Person } from "../src/lib/types";

/** Preserve rounding ties when using an already-resolved tab roster. */
export function orderExpensePeople(expense: Pick<Doc<"expenses">, "roundingOrder">, people: Person[]) {
  const order = expense.roundingOrder ?? [];
  const priority = new Map<string, number>(order.map((memberId, index) => [memberId, index]));
  return [...people].sort((a, b) => (priority.get(a.id) ?? order.length) - (priority.get(b.id) ?? order.length));
}

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
  return {
    ...expense, people: orderExpensePeople(expense, people),
  };
}

/** Reject foreign/missing members, even if a caller fabricates the UI payload. */
export async function assertExpenseMembers(ctx: QueryCtx | MutationCtx, expense: {
  tabId?: Doc<"expenses">["tabId"];
  items: Doc<"expenses">["items"];
  payerId?: string;
}) {
  if (!expense.tabId) throw new Error("Expense must belong to a tab");
  if (!expense.payerId) throw new Error("Choose who paid before saving the expense");
  const seats = await ctx.db.query("tabMembers").withIndex("by_tab", q => q.eq("tabId", expense.tabId!)).collect();
  const ids = new Set<string>(seats.map(seat => seat._id));
  for (const id of expense.items.flatMap(item => item.splitWith)) {
    if (!ids.has(id)) throw new Error("Split and payment participants must belong to this tab");
  }
  for (const item of expense.items) {
    if (item.splitWith.length === 0) throw new Error("Each expense item must be split with at least one tab member");
    if (new Set(item.splitWith).size !== item.splitWith.length) throw new Error("An expense item cannot list the same member twice");
  }
  if (expense.payerId !== undefined && !ids.has(expense.payerId)) throw new Error("Payer must belong to this tab");
}
