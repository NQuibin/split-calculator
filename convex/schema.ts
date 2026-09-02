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

export const receiptItem = v.object({
  id: v.string(),
  name: v.string(),
  cost: v.number(),
  discount: rateSetting,
  taxed: v.boolean(),
  tipped: v.boolean(),
  splitWith: v.array(v.string()),
});

export const contribution = v.object({
  personId: v.string(),
  amount: rateSetting,
});

export const receiptState = v.object({
  stage: v.union(v.literal("receipt"), v.literal("results")),
  people: v.array(person),
  namePeople: v.boolean(),
  items: v.array(receiptItem),
  tax: rateSetting,
  tip: rateSetting,
  date: v.string(),
  contributions: v.array(contribution),
});

export const groupMember = v.object({
  id: v.string(),
  name: v.string(),
  claimedByUserId: v.optional(v.id("users")),
  inviteToken: v.string(),
});

export const groupMemberLink = v.object({
  personId: v.string(),
  memberId: v.string(),
});

export default defineSchema({
  ...authTables,
  receipts: defineTable({
    slug: v.string(),
    userId: v.id("users"),
    stage: v.union(v.literal("receipt"), v.literal("results")),
    people: v.array(person),
    namePeople: v.boolean(),
    items: v.array(receiptItem),
    tax: rateSetting,
    tip: rateSetting,
    date: v.string(),
    contributions: v.array(contribution),
    updatedAt: v.number(),
    groupId: v.optional(v.id("groups")),
    groupMemberIds: v.optional(v.array(groupMemberLink)),
  })
    .index("by_user", ["userId"])
    .index("by_user_slug", ["userId", "slug"])
    .index("by_group", ["groupId"]),
  groups: defineTable({
    slug: v.string(),
    ownerUserId: v.id("users"),
    name: v.string(),
    members: v.array(groupMember),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerUserId"])
    .index("by_slug", ["slug"]),
  groupMemberships: defineTable({
    userId: v.id("users"),
    groupId: v.id("groups"),
  }).index("by_user", ["userId"]),
});
