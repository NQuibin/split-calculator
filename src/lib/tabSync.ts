import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Person, ExpenseItem } from "./types";

// Tabs have no guest/localStorage mode - you can't invite people into a
// tab that only exists in your own browser, so this hooks straight into
// Convex; expenseSync.ts separately supports local-only guest expenses.

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
  /** The identity this member resolves to once assigned to an expense - their real account id if claimed, otherwise the same as `id`. */
  resolvedId: string;
}

export interface TabDetail {
  slug: string;
  name: string;
  isOwner: boolean;
  members: TabMemberSummary[];
  defaultCurrency: string;
}

/**
 * undefined while loading, null if the tab doesn't exist. Throws an access
 * error (caught by the route's error boundary) when the tab exists but isn't
 * the viewer's. An invite `token` stands in for membership here, so an
 * invitee can see which tab they've been invited to before claiming it.
 */
export function useTab(slug: string, token?: string): TabDetail | null | undefined {
  return useQuery(api.tabs.getBySlug, slug ? { slug, token } : "skip");
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

export interface TabBreakdownExpenseLine {
  expenseSlug: string;
  expenseName: string;
  date: string;
  fairShare: number;
  contributed: number;
  balance: number;
}

export interface TabBreakdownMember {
  memberId: string;
  name: string;
  claimed: boolean;
  totalSpent: number;
  totalContributed: number;
  netBalance: number;
  expenseCount: number;
  expenses: TabBreakdownExpenseLine[];
}

export interface TabCurrencyBreakdown {
  convertedExpenseCount: number;
  currency: string;
  expenseCount: number;
  members: TabBreakdownMember[];
}

export interface TabBreakdown {
  tab: { name: string; slug: string };
  expenseCount: number;
  /** One independent settlement/breakdown per currency the tab's expenses use - balances in different currencies are never netted together. */
  currencies: TabCurrencyBreakdown[];
}

/** undefined while loading, null if the tab doesn't exist. */
export function useTabBreakdown(slug: string): TabBreakdown | null | undefined {
  return useQuery(api.tabs.breakdown, slug ? { slug } : "skip");
}

export interface TabExpenseSummary {
  mode: "simple" | "itemized";
  note?: string;
  image?: { name: string; type: string; url: string | null };
  date: string;
  createdBy: { id: string; name: string };
  slug: string;
  name?: string;
  people: Person[];
  items: ExpenseItem[];
  currency: string;
  settlementCurrency: string;
  exchangeRate?: import("./exchangeRate").ExchangeRate;
  createdAt: number;
}

export function useTabExpenses(slug: string): TabExpenseSummary[] {
  return useQuery(api.tabs.expensesForTab, slug ? { slug } : "skip") ?? [];
}

export function useTabActions() {
  return {
    setExpenseExchangeRate: useMutation(api.tabs.setExpenseExchangeRate),
    create: useMutation(api.tabs.create),
    rename: useMutation(api.tabs.rename),
    setDefaultCurrency: useMutation(api.tabs.setDefaultCurrency),
    deleteTab: useMutation(api.tabs.deleteTab),
    addMember: useMutation(api.tabs.addMember),
    renameMember: useMutation(api.tabs.renameMember),
    removeMember: useMutation(api.tabs.removeMember),
    claimMember: useMutation(api.tabs.claimMember),
    createExpense: useMutation(api.tabs.createExpense),
    addExpensePerson: useMutation(api.tabs.addExpensePerson),
  };
}
