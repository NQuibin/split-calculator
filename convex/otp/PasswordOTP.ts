import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { createAccount, retrieveAccount, signInViaProvider } from "@convex-dev/auth/server";
import { Scrypt } from "lucia";
import { ResendOTP } from "./ResendOTP";

/** Opt-in on the backend, restricted to a local frontend URL. Client-supplied
 * parameters cannot enable this bypass. */
export function skipOtpForLocalDevelopment() {
  if (process.env.AUTH_SKIP_OTP !== "true") return false;
  try {
    const url = new URL(process.env.SITE_URL ?? "");
    return (url.protocol === "http:" || url.protocol === "https:") &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

/** Every new email session requires both factors. A saved session recognizes
 * the browser until its absolute 30-day expiry, including across refreshes. */
export const PasswordOTP = ConvexCredentials({
  id: "password",
  crypto: {
    hashSecret: (password) => new Scrypt().hash(password),
    verifySecret: (password, hash) => new Scrypt().verify(hash, password),
  },
  // Deliberately private: calling resend-otp directly must never bypass password.
  extraProviders: [ResendOTP],
  async authorize(params, ctx) {
    const { email, password, flow } = params;
    if (typeof email !== "string" || !email.trim() ||
        typeof password !== "string" || !password) {
      throw new Error("Email and password are required");
    }
    if (flow !== "signUp" && flow !== "signIn" && flow !== "verify") {
      throw new Error("Invalid authentication flow");
    }
    const address = email.trim().toLowerCase();
    const credentials = { provider: "password", account: { id: address, secret: password } };
    const result = flow === "signUp"
      ? await (async () => {
          if (password.length < 8) throw new Error("Use at least 8 characters");
          return createAccount(ctx, {
            ...credentials,
            profile: { email: address },
            shouldLinkViaEmail: true,
          });
        })()
      : await retrieveAccount(ctx, credentials);
    if (!result) throw new Error("Invalid credentials");
    if (skipOtpForLocalDevelopment()) return { userId: result.user._id };
    if (flow === "verify" && (typeof params.code !== "string" || !/^\d{6}$/.test(params.code))) {
      throw new Error("A six-digit code is required");
    }
    // Never let a supplied code skip the password check or turn sign-up into
    // verification. Convex Auth handles code expiry, single use and throttling.
    return signInViaProvider(ctx, ResendOTP, {
      accountId: result.account._id,
      params: { email: address, ...(flow === "verify" ? { code: params.code } : {}) },
    });
  },
});
