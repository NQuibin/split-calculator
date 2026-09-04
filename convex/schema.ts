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

export const expenseState = v.object({
  stage: v.union(v.literal("receipt"), v.literal("results")),
  name: v.optional(v.string()),
  people: v.array(person),
  namePeople: v.boolean(),
  mode: expenseMode,
  items: v.array(expenseItem),
  date: v.string(),
  contributions: v.array(contribution),
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
  expenses: defineTable({
    slug: v.string(),
    userId: v.id("users"),
    stage: v.union(v.literal("receipt"), v.literal("results")),
    name: v.optional(v.string()),
    people: v.array(person),
    namePeople: v.boolean(),
    mode: expenseMode,
    items: v.array(expenseItem),
    date: v.string(),
    contributions: v.array(contribution),
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
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerUserId"])
    .index("by_slug", ["slug"]),
  tabMemberships: defineTable({
    userId: v.id("users"),
    tabId: v.id("tabs"),
  }).index("by_user", ["userId"]),
});
