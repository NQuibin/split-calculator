import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

// Claimed seats follow the account's current name, with email and the saved
// seat name as fallbacks.
export async function resolveSeatName(ctx: QueryCtx | MutationCtx, seat: Doc<"tabMembers">) {
  if (!seat.userId) return seat.name;
  const user = await ctx.db.get(seat.userId);
  return user?.name?.trim() || user?.email?.trim() || seat.name;
}
