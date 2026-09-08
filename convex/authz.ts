import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

// Every access failure leaves here as a ConvexError carrying a `code`, so the
// client can tell "sign in and you're fine" from "this isn't yours" and render
// the right page instead of a generic crash. The human-readable `message` is
// kept alongside the code because ConvexError stringifies its data into
// `Error.message`, which is what surfaces in logs and in tests.

export type AccessCode = "unauthenticated" | "forbidden";

export type AccessErrorData = {
  code: AccessCode;
  message: string;
  // ConvexError only accepts index-signature objects as its payload.
  [key: string]: string;
};

/** The caller isn't signed in at all. */
export function unauthenticated(message = "Not signed in"): never {
  throw new ConvexError<AccessErrorData>({ code: "unauthenticated", message });
}

/** The caller is signed in, but this resource isn't theirs to see or touch. */
export function forbidden(message = "Not authorized"): never {
  throw new ConvexError<AccessErrorData>({ code: "forbidden", message });
}

export async function requireUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) unauthenticated();
  return userId;
}

/**
 * Who is allowed to see a tab: the owner, and anyone holding a seat in it.
 * The ownership check comes first because it needs no read at all - the tab
 * document is already in hand - and it covers the common case.
 */
export async function canViewTab(
  ctx: QueryCtx | MutationCtx,
  tab: Doc<"tabs">,
  userId: Id<"users">,
): Promise<boolean> {
  if (tab.ownerUserId === userId) return true;
  // Indexed by user rather than by tab: a person sits in few tabs, so this
  // scans far less than a popular tab's whole roster would.
  const seats = await ctx.db
    .query("tabMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return seats.some((seat) => seat.tabId === tab._id);
}

/** An unclaimed invite link is a bearer capability for the tab it points at. */
export async function isInviteToken(
  ctx: QueryCtx | MutationCtx,
  tab: Doc<"tabs">,
  token: string | undefined,
): Promise<boolean> {
  if (token === undefined) return false;
  const seats = await ctx.db
    .query("tabMembers")
    .withIndex("by_tab", (q) => q.eq("tabId", tab._id))
    .collect();
  return seats.some((seat) => seat.inviteToken === token);
}

/** Throws unless the caller is in the tab. Returns their user id. */
export async function requireTabViewer(
  ctx: QueryCtx | MutationCtx,
  tab: Doc<"tabs">,
): Promise<Id<"users">> {
  const userId = await requireUserId(ctx);
  if (!(await canViewTab(ctx, tab, userId))) forbidden();
  return userId;
}

/** Throws unless the caller owns the tab. Returns their user id. */
export async function requireTabOwner(
  ctx: QueryCtx | MutationCtx,
  tab: Doc<"tabs">,
): Promise<Id<"users">> {
  const userId = await requireUserId(ctx);
  if (tab.ownerUserId !== userId) forbidden();
  return userId;
}
