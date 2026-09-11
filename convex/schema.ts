import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const rateSetting = v.object({
  mode: v.union(v.literal("percent"), v.literal("amount")),
  value: v.number(),
});

export const person = v.object({
  id: v.string(),
  name: v.string(),
});

export const expenseItem = v.object({
  id: v.string(),
  name: v.string(),
  cost: v.number(),
  discount: rateSetting,
  tax: rateSetting,
  tip: rateSetting,
  splitWith: v.array(v.string()),
});

export const expenseMode = v.union(v.literal("simple"), v.literal("itemized"));

/** A receipt photo (or PDF) attached to an expense. `name` is the original filename, kept for the download/open link. */
export const expenseImage = v.object({
  storageId: v.id("_storage"),
  name: v.string(),
  type: v.string(),
});

export const expenseState = v.object({
  name: v.string(),
  /** The editor's working roster. Accepted from the client but never stored on an expense - `tabMembers` seats are the source of truth, and only `roundingOrder` is kept from it. */
  people: v.array(person),
  mode: expenseMode,
  items: v.array(expenseItem),
  date: v.string(),
  /** ISO 4217 code, e.g. "USD". Optional on the stored doc so expenses saved before this field existed keep validating - default to "USD" when reading. */
  currency: v.optional(v.string()),
  /** Free-form note about the expense. Absent when there's no note - an empty/whitespace-only note is stored as no note at all. */
  note: v.optional(v.string()),
  /** Receipt image/PDF attached to the expense, if any. Absent once removed. */
  image: v.optional(expenseImage),
});

export default defineSchema({
  ...authTables,
  // Extends authTables' users table (see its docstring) with our own
  // preference field. `isAnonymous` is deliberately absent: only Convex
  // Auth's Anonymous provider ever writes it, and this app configures
  // Google and an email OTP. Add it back if that provider is ever adopted.
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    /** ISO 4217 code, e.g. "USD" - used as the starting currency for a brand-new expense outside of a tab. */
    defaultCurrency: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),
  expenses: defineTable({
    slug: v.string(),
    userId: v.id("users"),
    name: v.string(),
    memberReferencesVersion: v.optional(v.literal(1)),
    /** Stable tie order for assigning rounding pennies; contains seat IDs only. */
    roundingOrder: v.optional(v.array(v.id("tabMembers"))),
    mode: expenseMode,
    items: v.array(expenseItem),
    date: v.string(),
    currency: v.optional(v.string()),
    exchangeRate: v.optional(v.object({ from: v.string(), to: v.string(), rate: v.number() })),
    note: v.optional(v.string()),
    image: v.optional(expenseImage),
    updatedAt: v.number(),
    tabId: v.optional(v.id("tabs")),
  })
    .index("by_user", ["userId"])
    .index("by_user_slug", ["userId", "slug"])
    // Slugs are random and effectively unique, but they're only *enforced*
    // unique per user - so this index exists to answer "does this /e/{slug}
    // link belong to someone else?" and tell a forbidden page from a 404.
    .index("by_slug", ["slug"])
    .index("by_tab", ["tabId"]),
  tabs: defineTable({
    slug: v.string(),
    ownerUserId: v.id("users"),
    name: v.string(),
    /** ISO 4217 code, e.g. "USD" - the starting currency for a new expense created directly inside this tab. */
    defaultCurrency: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_slug", ["slug"]),
  /** Stable identity for splits and payments. Claiming only sets userId. */
  tabMembers: defineTable({
    tabId: v.id("tabs"),
    name: v.string(),
    inviteToken: v.string(),
    userId: v.optional(v.id("users")),
  })
    .index("by_tab", ["tabId"])
    .index("by_user", ["userId"]),
});
