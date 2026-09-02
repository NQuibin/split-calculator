"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Person, RateSetting, ReceiptItem } from "./types";

// Groups have no guest/localStorage mode - you can't invite people into a
// group that only exists in your own browser, so this hooks straight into
// Convex with no offline fallback, unlike receiptSync.ts.

export interface GroupListItem {
  slug: string;
  name: string;
  isOwner: boolean;
  memberCount: number;
}

export function useGroupList(): GroupListItem[] {
  return useQuery(api.groups.list) ?? [];
}

export interface GroupMemberSummary {
  id: string;
  name: string;
  claimed: boolean;
}

export interface GroupDetail {
  slug: string;
  name: string;
  isOwner: boolean;
  members: GroupMemberSummary[];
}

/** undefined while loading, null if the group doesn't exist. */
export function useGroup(slug: string): GroupDetail | null | undefined {
  return useQuery(api.groups.getBySlug, slug ? { slug } : "skip");
}

export interface GroupInviteLink {
  memberId: string;
  name: string;
  token: string;
}

/** Only resolves for the group's owner; empty while loading or unauthorized. */
export function useGroupInviteLinks(slug: string, enabled: boolean): GroupInviteLink[] {
  return useQuery(api.groups.getInviteLinks, enabled && slug ? { slug } : "skip") ?? [];
}

export interface GroupBreakdownMember {
  memberId: string;
  name: string;
  claimed: boolean;
  totalSpent: number;
  totalContributed: number;
  netBalance: number;
  receiptCount: number;
}

export interface GroupBreakdown {
  group: { name: string; slug: string };
  receiptCount: number;
  members: GroupBreakdownMember[];
}

/** undefined while loading, null if the group doesn't exist. */
export function useGroupBreakdown(slug: string): GroupBreakdown | null | undefined {
  return useQuery(api.groups.breakdown, slug ? { slug } : "skip");
}

export interface GroupReceiptSummary {
  slug: string;
  people: Person[];
  items: ReceiptItem[];
  tax: RateSetting;
  tip: RateSetting;
  updatedAt: number;
}

export function useGroupReceipts(slug: string): GroupReceiptSummary[] {
  return useQuery(api.groups.receiptsForGroup, slug ? { slug } : "skip") ?? [];
}

export function useGroupActions() {
  return {
    create: useMutation(api.groups.create),
    rename: useMutation(api.groups.rename),
    deleteGroup: useMutation(api.groups.deleteGroup),
    addMember: useMutation(api.groups.addMember),
    renameMember: useMutation(api.groups.renameMember),
    removeMember: useMutation(api.groups.removeMember),
    claimMember: useMutation(api.groups.claimMember),
    assignReceipt: useMutation(api.groups.assignReceipt),
    unassignReceipt: useMutation(api.groups.unassignReceipt),
  };
}
