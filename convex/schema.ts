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

export const contribution = v.object({
  personId: v.string(),
  amount: rateSetting,
});

export const expenseMode = v.union(v.literal("simple"), v.literal("itemized"));

/** A receipt photo (or PDF) attached to an expense. `name` is the original filename, kept for the download/open link. */
export const expenseImage = v.object({
  storageId: v.id("_storage"),
  name: v.string(),
  type: v.string(),
});

export const expenseState = v.object({
  stage: v.union(v.literal("receipt"), v.literal("results")),
  name: v.string(),
  people: v.array(person),
  namePeople: v.boolean(),
  mode: expenseMode,
  items: v.array(expenseItem),
  date: v.string(),
  contributions: v.array(contribution),
  /** ISO 4217 code, e.g. "USD". Optional on the stored doc so expenses saved before this field existed keep validating - default to "USD" when reading. */
  currency: v.optional(v.string()),
  /** Free-form note about the expense. Absent when there's no note - an empty/whitespace-only note is stored as no note at all. */
  note: v.optional(v.string()),
  /** Receipt image/PDF attached to the expense, if any. Absent once removed. */
  image: v.optional(expenseImage),
});

export const tabMember = v.object({
  id: v.string(),
  name: v.string(),
  claimedByUserId: v.optional(v.id("users")),
  inviteToken: v.string(),
});

export const tabMemberLink = v.object({
  personId: v.string(),
  memberId: v.string(),
});

export default defineSchema({
  ...authTables,
  // Extends authTables' users table (see its docstring) with our own
  // preference field.
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    /** ISO 4217 code, e.g. "USD" - used as the starting currency for a brand-new expense outside of a tab. */
    defaultCurrency: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),
  expenses: defineTable({
    slug: v.string(),
    userId: v.id("users"),
    stage: v.union(v.literal("receipt"), v.literal("results")),
    name: v.string(),
    people: v.array(person),
    namePeople: v.boolean(),
    mode: expenseMode,
    items: v.array(expenseItem),
    date: v.string(),
    contributions: v.array(contribution),
    currency: v.optional(v.string()),
    note: v.optional(v.string()),
    image: v.optional(expenseImage),
    updatedAt: v.number(),
    tabId: v.optional(v.id("tabs")),
    tabMemberIds: v.optional(v.array(tabMemberLink)),
  })
    .index("by_user", ["userId"])
    .index("by_user_slug", ["userId", "slug"])
    .index("by_tab", ["tabId"]),
  tabs: defineTable({
    slug: v.string(),
    ownerUserId: v.id("users"),
    name: v.string(),
    members: v.array(tabMember),
    /** ISO 4217 code, e.g. "USD" - the starting currency for a new expense created directly inside this tab. */
    defaultCurrency: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerUserId"])
    .index("by_slug", ["slug"]),
  tabMemberships: defineTable({
    userId: v.id("users"),
    tabId: v.id("tabs"),
  }).index("by_user", ["userId"]),
});
