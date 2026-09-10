import { Password } from "@convex-dev/auth/providers/Password";
import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";
import { PasswordOTP } from "./otp/PasswordOTP";

/** A browser's saved session recognizes it for at most 30 days. After
 * expiry (or on another browser), email authentication requires password + OTP. */
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  // An explicit rollout switch preserves password sign-in on deployments
  // whose verification email sender has not yet been configured.
  providers: [Google, process.env.AUTH_REQUIRE_EMAIL_OTP === "false" ? Password : PasswordOTP],
  session: { totalDurationMs: SESSION_DURATION_MS },
});
