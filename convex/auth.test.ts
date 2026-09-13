/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { skipOtpForLocalDevelopment } from "./otp/PasswordOTP";

const modules = import.meta.glob("./**/*.ts");
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test("email sessions require a password and a fresh OTP, including for verified accounts", async () => {
  const keys = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const key = new Uint8Array(await crypto.subtle.exportKey("pkcs8", keys.privateKey));
  vi.stubEnv(
    "JWT_PRIVATE_KEY",
    `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...key))}\n-----END PRIVATE KEY-----`,
  );
  vi.stubEnv("CONVEX_SITE_URL", "https://example.convex.site");
  vi.stubEnv("RESEND_API_KEY", "test");
  vi.stubEnv("SITE_URL", "https://example.com");
  let code = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, options) => {
      const body = JSON.parse(options.body);
      code = body.subject.match(/^\d{6}/)[0];
      return new Response("{}", { status: 200 });
    }),
  );
  const t = convexTest(schema, modules);
  const legacyUser = await t.run((ctx) =>
    ctx.db.insert("users", { email: "test@example.com", emailVerificationTime: Date.now() }),
  );
  const credentials = { email: "test@example.com", password: "a-long-password" };
  const signIn = (params: Record<string, string>, provider = "password") =>
    t.action(api.auth.signIn, { provider, params });
  await expect(signIn({ email: credentials.email, flow: "signUp" })).rejects.toThrow();
  await expect(signIn({ ...credentials, password: "short", flow: "signUp" })).rejects.toThrow();
  const pending = await signIn({ ...credentials, flow: "signUp" });
  expect(pending.tokens).toBeNull();
  expect(await t.run((ctx) => ctx.db.query("authSessions").collect())).toHaveLength(0);
  await expect(signIn({ email: credentials.email, code }, "resend-otp")).rejects.toThrow();
  await expect(signIn({ email: credentials.email, code, flow: "verify" })).rejects.toThrow();
  await expect(
    signIn({ ...credentials, password: "wrong", code, flow: "verify" }),
  ).rejects.toThrow();
  const signedIn = await signIn({ ...credentials, code, flow: "verify" });
  expect(signedIn.tokens).toBeTruthy();
  const sessions = await t.run((ctx) => ctx.db.query("authSessions").collect());
  expect(sessions[0].userId).toBe(legacyUser);
  expect(sessions[0].expirationTime - sessions[0]._creationTime).toBeCloseTo(
    30 * 24 * 60 * 60 * 1000,
    -3,
  );
  await expect(signIn({ ...credentials, code, flow: "verify" })).rejects.toThrow();
  expect((await signIn({ ...credentials, flow: "signIn" })).tokens).toBeNull();
  await t.run(async (ctx) => {
    for (const token of await ctx.db.query("authVerificationCodes").collect()) {
      await ctx.db.patch(token._id, { expirationTime: Date.now() - 1 });
    }
  });
  await expect(signIn({ ...credentials, code, flow: "verify" })).rejects.toThrow();
  vi.stubEnv("AUTH_SKIP_OTP", "true");
  vi.stubEnv("SITE_URL", "http://localhost:5173");
  vi.mocked(fetch).mockClear();
  await expect(signIn({ ...credentials, password: "wrong", flow: "signIn" })).rejects.toThrow();
  expect((await signIn({ ...credentials, flow: "signIn" })).tokens).toBeTruthy();
  expect(
    (await signIn({ email: "new@example.com", password: "another-password", flow: "signUp" }))
      .tokens,
  ).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
});

test("OTP bypass requires explicit server opt-in and a loopback site URL", () => {
  vi.stubEnv("SITE_URL", "http://localhost:5173");
  vi.stubEnv("AUTH_SKIP_OTP", "false");
  expect(skipOtpForLocalDevelopment()).toBe(false);
  vi.stubEnv("AUTH_SKIP_OTP", "true");
  for (const url of ["http://localhost:5173", "http://127.0.0.1:5173", "http://[::1]:5173"]) {
    vi.stubEnv("SITE_URL", url);
    expect(skipOtpForLocalDevelopment()).toBe(true);
  }
  for (const url of ["https://ventura.app", "https://localhost.evil.com", "", "invalid"]) {
    vi.stubEnv("SITE_URL", url);
    expect(skipOtpForLocalDevelopment()).toBe(false);
  }
});
