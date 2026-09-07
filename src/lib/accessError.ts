import { ConvexError } from "convex/values";
import type { AccessCode } from "../../convex/authz";

/**
 * The access code a Convex error carries, or `null` if it isn't one. Convex
 * queries throw during render, so this is what the route error boundaries use
 * to tell "sign in and this works" and "this isn't yours" apart from a real
 * crash, which should keep bubbling.
 */
export function accessErrorCode(error: unknown): AccessCode | null {
  if (!(error instanceof ConvexError)) return null;
  const data = error.data as { code?: unknown } | null;
  if (typeof data !== "object" || data === null) return null;
  return data.code === "forbidden" || data.code === "unauthenticated" ? data.code : null;
}
