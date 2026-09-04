"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Person, RateSetting, ReceiptItem } from "./types";

// Tabs have no guest/localStorage mode - you can't invite people into a
// tab that only exists in your own browser, so this hooks straight into
// Convex with no offline fallback, unlike receiptSync.ts.

export interface TabListItem {
  slug: string;
  name: string;
  isOwner: boolean;
  memberCount: number;
}

export function useTabList(): TabListItem[] {
  return useQuery(api.tabs.list) ?? [];
}

export interface TabMemberSummary {
  id: string;
  name: string;
  claimed: boolean;
}

export interface TabDetail {
  slug: string;
  name: string;
  isOwner: boolean;
  members: TabMemberSummary[];
}

/** undefined while loading, null if the tab doesn't exist. */
export function useTab(slug: string): TabDetail | null | undefined {
  return useQuery(api.tabs.getBySlug, slug ? { slug } : "skip");
}

export interface TabInviteLink {
  memberId: string;
  name: string;
  token: string;
}

/** Only resolves for the tab's owner; empty while loading or unauthorized. */
export function useTabInviteLinks(slug: string, enabled: boolean): TabInviteLink[] {
  return useQuery(api.tabs.getInviteLinks, enabled && slug ? { slug } : "skip") ?? [];
}

export interface TabBreakdownMember {
  memberId: string;
  name: string;
  claimed: boolean;
  totalSpent: number;
  totalContributed: number;
  netBalance: number;
  receiptCount: number;
}

export interface TabBreakdown {
  tab: { name: string; slug: string };
  receiptCount: number;
  members: TabBreakdownMember[];
}

/** undefined while loading, null if the tab doesn't exist. */
export function useTabBreakdown(slug: string): TabBreakdown | null | undefined {
  return useQuery(api.tabs.breakdown, slug ? { slug } : "skip");
}

export interface TabReceiptSummary {
  slug: string;
  name?: string;
  people: Person[];
  items: ReceiptItem[];
  tax: RateSetting;
  tip: RateSetting;
  updatedAt: number;
}

export function useTabReceipts(slug: string): TabReceiptSummary[] {
  return useQuery(api.tabs.receiptsForTab, slug ? { slug } : "skip") ?? [];
}

export function useTabActions() {
  return {
    create: useMutation(api.tabs.create),
    rename: useMutation(api.tabs.rename),
    deleteTab: useMutation(api.tabs.deleteTab),
    addMember: useMutation(api.tabs.addMember),
    renameMember: useMutation(api.tabs.renameMember),
    removeMember: useMutation(api.tabs.removeMember),
    claimMember: useMutation(api.tabs.claimMember),
    assignReceipt: useMutation(api.tabs.assignReceipt),
    addReceiptPerson: useMutation(api.tabs.addReceiptPerson),
    unassignReceipt: useMutation(api.tabs.unassignReceipt),
  };
}
