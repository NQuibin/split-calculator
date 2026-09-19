import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import {
  createAccount,
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
  signInViaProvider,
} from "@convex-dev/auth/server";
import { Scrypt } from "lucia";
import { ResendOTP } from "./ResendOTP";

/** Opt-in on the backend, restricted to a local frontend URL. Client-supplied
 * parameters cannot enable this bypass. */
export function skipOtpForLocalDevelopment() {
  if (process.env.AUTH_SKIP_OTP !== "true") return false;
  try {
    const url = new URL(process.env.SITE_URL ?? "");
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    );
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
    if (typeof email !== "string" || !email.trim()) {
      throw new Error("Email is required");
    }
    if (
      flow !== "signUp" &&
      flow !== "signIn" &&
      flow !== "verify" &&
      flow !== "reset" &&
      flow !== "reset-verification"
    ) {
      throw new Error("Invalid authentication flow");
    }
    const address = email.trim().toLowerCase();

    if (flow === "reset") {
      // A missing account deliberately returns null, matching the generic
      // failed-sign-in result rather than exposing whether an email exists.
      const result = await retrieveAccountSafely(ctx, address);
      if (!result) return null;
      return signInViaProvider(ctx, ResendOTP, {
        accountId: result.account._id,
        params: { email: address, flow },
      });
    }

    if (flow === "reset-verification") {
      const newPassword = params.newPassword;
      if (typeof newPassword !== "string" || newPassword.length < 8) {
        throw new Error("Use at least 8 characters");
      }
      if (typeof params.code !== "string" || !/^\d{6}$/.test(params.code)) {
        throw new Error("A six-digit code is required");
      }
      const result = await retrieveAccountSafely(ctx, address);
      if (!result) return null;
      const verified = await signInViaProvider(ctx, ResendOTP, {
        params: { email: address, code: params.code, flow },
      });
      if (!verified || verified.userId !== result.user._id) {
        throw new Error("Invalid code");
      }
      await modifyAccountCredentials(ctx, {
        provider: "password",
        account: { id: address, secret: newPassword },
      });
      await invalidateSessions(ctx, { userId: verified.userId, except: [verified.sessionId] });
      return verified;
    }

    if (typeof password !== "string" || !password) {
      throw new Error("Email and password are required");
    }
    const credentials = { provider: "password", account: { id: address, secret: password } };
    const result =
      flow === "signUp"
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

async function retrieveAccountSafely(ctx: Parameters<typeof retrieveAccount>[0], address: string) {
  try {
    return await retrieveAccount(ctx, {
      provider: "password",
      account: { id: address },
    });
  } catch {
    return null;
  }
}
