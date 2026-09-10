import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

/**
 * One-off migration for the password -> email-OTP switch.
 *
 * Convex Auth only links a new sign-in to an existing user when that user
 * already has `emailVerificationTime` set (see `uniqueUserWithVerifiedEmail`
 * in @convex-dev/auth). The old Password provider ran without a `verify:`
 * step, so accounts it created have that field unset - meaning the first OTP
 * sign-in with the same address would mint a *second* user document and
 * orphan every tab and expense hanging off the first one.
 *
 * Stamping the field says "this address was verified", so it is only correct
 * for accounts whose owner is known to control the inbox. Take an address at
 * a time rather than sweeping the table, so nobody gets handed an account
 * that was registered under an email its owner never proved.
 *
 * Delete this file once both deployments have been migrated.
 */
export const markEmailVerified = internalMutation({
  args: { email: v.string() },
  returns: v.union(
    v.object({ status: v.literal("verified"), userId: v.id("users") }),
    v.object({ status: v.literal("already-verified"), userId: v.id("users") }),
    v.object({ status: v.literal("no-such-user") }),
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .unique();

    if (user === null) return { status: "no-such-user" as const };
    if (user.emailVerificationTime !== undefined) {
      return { status: "already-verified" as const, userId: user._id };
    }

    await ctx.db.patch(user._id, { emailVerificationTime: Date.now() });
    return { status: "verified" as const, userId: user._id };
  },
});
