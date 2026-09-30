import { v } from "convex/values";
import { computeShares, computeSplit, round2 } from "../src/lib/calculations";
import { CURRENCIES } from "../src/lib/currencies";
import { activeExchangeRate, convertShares } from "../src/lib/exchangeRate";
import { isValidISODate } from "../src/lib/format";
import { suggestSettlements } from "../src/lib/settlements";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireTabViewer } from "./authz";
import { orderExpensePeople } from "./expenseMembers";
import { resolveSeatName } from "./tabs";

// Never return partial balances. A larger tab needs a paginated ledger before
// it can be settled; the extra row detects that boundary explicitly.
const READ_LIMIT = 500;
const currencyCodes = new Set(CURRENCIES.map((c) => c.code));
type ReadCtx = QueryCtx | MutationCtx;
type ExpenseView = "paid" | "upcoming" | "all";
const expenseViewValidator = v.union(v.literal("paid"), v.literal("upcoming"), v.literal("all"));
type MemberTotals = {
  paidCents: number;
  paidForCount: number;
  includedInCount: number;
  shareCents: number;
  transferredCents: number;
  /** Direct debt edges, keyed by debtor member id, then creditor member id. */
  directDebts: Map<string, number>;
  hasSharedExpenseWithViewer: boolean;
};
type CurrencyTotals = Map<string, MemberTotals>;
type ExpenseDebt = {
  expenseId: Id<"expenses">;
  expenseSlug: string;
  name: string;
  date: string;
  outstanding: number;
};

function paymentCents(amount: number) {
  const value = amount * 100;
  const rounded = Math.round(value);
  if (
    !Number.isFinite(amount) ||
    rounded <= 0 ||
    !Number.isSafeInteger(rounded) ||
    Math.abs(value - rounded) > 1e-7
  ) {
    throw new Error("Amount must be positive with at most two decimal places");
  }
  return rounded;
}

function checkedCents(amount: number) {
  const value = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(value)) {
    throw new Error("An expense amount is too large or invalid to settle");
  }
  return value;
}

function addCents(current: number, amount: number) {
  const sum = current + amount;
  if (!Number.isSafeInteger(sum)) throw new Error("This tab's balance is too large to settle");
  return sum;
}

async function limited<T>(value: Promise<T[]>, name: string, limit = READ_LIMIT) {
  const rows = await value;
  if (rows.length > limit)
    throw new Error(
      `Settlement balances support up to ${limit} ${name} per tab. This tab needs a larger ledger before it can be settled.`,
    );
  return rows;
}

async function findTab(ctx: ReadCtx, slug: string) {
  return await ctx.db
    .query("tabs")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
}

function blank(roster: Doc<"tabMembers">[]): CurrencyTotals {
  return new Map(
    roster.map((seat) => [
      seat._id,
      {
        paidCents: 0,
        paidForCount: 0,
        includedInCount: 0,
        shareCents: 0,
        transferredCents: 0,
        directDebts: new Map(),
        hasSharedExpenseWithViewer: false,
      },
    ]),
  );
}

function net(totals: MemberTotals) {
  return addCents(addCents(totals.paidCents, -totals.shareCents), totals.transferredCents);
}

function addDirectDebt(
  totals: CurrencyTotals,
  fromMemberId: string,
  toMemberId: string,
  amount: number,
) {
  if (fromMemberId === toMemberId || amount === 0) return;
  const debtor = totals.get(fromMemberId);
  if (!debtor) throw new Error("A settlement references a missing member");
  const current = debtor.directDebts.get(toMemberId) ?? 0;
  debtor.directDebts.set(toMemberId, addCents(current, amount));
}

/** Positive means the member owes the viewer; negative means the viewer owes them. */
function directBalanceWithViewer(totals: CurrencyTotals, memberId: string, viewerMemberId: string) {
  const member = totals.get(memberId);
  const viewer = totals.get(viewerMemberId);
  if (!member || !viewer) throw new Error("A settlement references a missing member");
  const memberOwesViewer = member.directDebts.get(viewerMemberId) ?? 0;
  const viewerOwesMember = viewer.directDebts.get(memberId) ?? 0;
  return addCents(memberOwesViewer, -viewerOwesMember);
}

function appliesToView(paymentView: ExpenseView, expenseView: ExpenseView) {
  return expenseView === "all" || paymentView === expenseView;
}

function expenseDebtKey(currency: string, fromMemberId: string, toMemberId: string) {
  return `${currency}:${fromMemberId}:${toMemberId}`;
}

const paymentFields = {
  fromMemberId: v.id("tabMembers"),
  toMemberId: v.id("tabMembers"),
  amount: v.number(),
  currency: v.string(),
  date: v.string(),
  note: v.optional(v.string()),
  requestId: v.string(),
};
const paymentValidator = v.object(paymentFields);

type PaymentInput = {
  fromMemberId: Id<"tabMembers">;
  toMemberId: Id<"tabMembers">;
  amount: number;
  currency: string;
  date: string;
  note?: string;
  requestId: string;
};
type NormalizedPayment = Omit<PaymentInput, "amount"> & {
  amountCents: number;
};

function normalizePayment(payment: PaymentInput): NormalizedPayment {
  const amountCents = paymentCents(payment.amount);
  const requestId = payment.requestId.trim();
  const note = payment.note?.trim() || undefined;
  if (!currencyCodes.has(payment.currency) || !isValidISODate(payment.date))
    throw new Error("Use a supported currency and real YYYY-MM-DD dates");
  if (!requestId || requestId.length > 128) throw new Error("A valid request id is required");
  if (note && note.length > 2000) throw new Error("Payment notes must be 2,000 characters or less");
  if (payment.fromMemberId === payment.toMemberId)
    throw new Error("Settlement members must be distinct");
  return { ...payment, amountCents, requestId, note };
}

function samePayment(prior: Doc<"settlements">, payment: NormalizedPayment, view: ExpenseView) {
  return (
    prior.fromMemberId === payment.fromMemberId &&
    prior.toMemberId === payment.toMemberId &&
    prior.amountCents === payment.amountCents &&
    prior.currency === payment.currency &&
    prior.date === payment.date &&
    prior.note === payment.note &&
    (prior.view ?? "paid") === view
  );
}

/** Read one coherent ledger snapshot, shared by the query and payment mutation. */
async function readBalances(
  ctx: ReadCtx,
  tab: Doc<"tabs">,
  asOfDate: string,
  viewerUserId?: Id<"users">,
) {
  const [roster, expenses, payments] = await Promise.all([
    limited(
      ctx.db
        .query("tabMembers")
        .withIndex("by_tab", (q) => q.eq("tabId", tab._id))
        .take(READ_LIMIT + 1),
      "members",
    ),
    limited(
      ctx.db
        .query("expenses")
        .withIndex("by_tab", (q) => q.eq("tabId", tab._id))
        .take(READ_LIMIT + 1),
      "expenses",
    ),
    limited(
      ctx.db
        .query("settlements")
        .withIndex("by_tabId", (q) => q.eq("tabId", tab._id))
        .take(READ_LIMIT + 1),
      "payments",
    ),
  ]);
  const people = await Promise.all(
    roster.map(async (seat) => ({ id: seat._id, name: await resolveSeatName(ctx, seat) })),
  );
  const memberIds = new Set<string>(people.map((person) => person.id));
  const viewerMemberId = roster.find((seat) => seat.userId === viewerUserId)?._id;
  const views = {} as Record<
    ExpenseView,
    {
      byCurrency: Map<string, CurrencyTotals>;
      expenseDebts: Map<string, ExpenseDebt[]>;
      missingPayers: { slug: string; name: string }[];
    }
  >;

  for (const expenseView of ["paid", "upcoming", "all"] as const) {
    const byCurrency = new Map<string, CurrencyTotals>();
    const expenseDebts = new Map<string, ExpenseDebt[]>();
    const missingPayers: { slug: string; name: string }[] = [];
    for (const expense of expenses) {
      const isUpcoming = expense.date > asOfDate;
      if ((expenseView === "paid" && isUpcoming) || (expenseView === "upcoming" && !isUpcoming))
        continue;
      if (!expense.payerId || !memberIds.has(expense.payerId)) {
        missingPayers.push({ slug: expense.slug, name: expense.name });
        continue;
      }
      if (
        expense.items.some(
          (item) =>
            item.splitWith.length === 0 ||
            new Set(item.splitWith).size !== item.splitWith.length ||
            item.splitWith.some((id) => !memberIds.has(id)),
        )
      ) {
        throw new Error(
          `Expense "${expense.name || expense.slug}" needs a valid split before settling`,
        );
      }
      const split = computeSplit(
        orderExpensePeople(expense, people),
        expense.items,
        expense.globalAdjustments,
      );
      const rate = activeExchangeRate(expense, tab.defaultCurrency ?? "USD");
      const code = rate?.to ?? expense.currency ?? "USD";
      const convertedTotal = rate ? round2(split.grandTotal * rate.rate) : split.grandTotal;
      const totalCents = checkedCents(convertedTotal);
      const shares = rate
        ? convertShares(computeShares(split), split.grandTotal, rate.rate)
        : computeShares(split);
      const shareAmounts = shares.map((share) => checkedCents(share.fairShare));
      if (shareAmounts.reduce(addCents, 0) !== totalCents)
        throw new Error(`Expense "${expense.name || expense.slug}" has inconsistent shares`);
      const totals = byCurrency.get(code) ?? blank(roster);
      for (const [index, share] of shares.entries()) {
        const shareCents = shareAmounts[index];
        if (share.personId === expense.payerId || shareCents === 0) continue;
        const key = expenseDebtKey(code, share.personId, expense.payerId);
        const debts = expenseDebts.get(key) ?? [];
        debts.push({
          expenseId: expense._id,
          expenseSlug: expense.slug,
          name: expense.name,
          date: expense.date,
          outstanding: shareCents / 100,
        });
        expenseDebts.set(key, debts);
      }
      if (
        viewerMemberId &&
        (expense.payerId === viewerMemberId ||
          expense.items.some((item) => item.splitWith.includes(viewerMemberId)))
      ) {
        for (const memberId of new Set([
          expense.payerId,
          ...expense.items.flatMap((item) => item.splitWith),
        ])) {
          if (memberId !== viewerMemberId) {
            const member = totals.get(memberId);
            if (member) member.hasSharedExpenseWithViewer = true;
          }
        }
      }
      shares.forEach((share, index) => {
        const member = totals.get(share.personId)!;
        member.shareCents = addCents(member.shareCents, shareAmounts[index]);
        if (shareAmounts[index] !== 0) member.includedInCount += 1;
        addDirectDebt(totals, share.personId, expense.payerId, shareAmounts[index]);
      });
      const payer = totals.get(expense.payerId)!;
      payer.paidCents = addCents(payer.paidCents, totalCents);
      payer.paidForCount += 1;
      byCurrency.set(code, totals);
    }

    for (const payment of payments) {
      const paymentView = payment.view ?? "paid";
      if (!appliesToView(paymentView, expenseView)) continue;
      if (payment.date > asOfDate || payment.reversedAt !== undefined) continue;
      if (!memberIds.has(payment.fromMemberId) || !memberIds.has(payment.toMemberId)) {
        throw new Error("A settlement references a missing member");
      }
      // A repayment remains real even if the related expense is edited/deleted
      // or its conversion currency changes. Keep its original currency bucket.
      const totals = byCurrency.get(payment.currency) ?? blank(roster);
      const sender = totals.get(payment.fromMemberId)!;
      const recipient = totals.get(payment.toMemberId)!;
      sender.transferredCents = addCents(sender.transferredCents, payment.amountCents);
      recipient.transferredCents = addCents(recipient.transferredCents, -payment.amountCents);
      // A payment reduces the direct debt edge from sender to recipient. A
      // negative edge represents an overpayment in the opposite direction.
      addDirectDebt(totals, payment.fromMemberId, payment.toMemberId, -payment.amountCents);
      byCurrency.set(payment.currency, totals);
    }
    // Netting opposite debt edges (including payments) covers oldest expenses first.
    for (const [key, debts] of expenseDebts) {
      const [, from, to] = key.split(":");
      const totals = byCurrency.get(key.split(":")[0])!;
      const netDebt = Math.max(0, directBalanceWithViewer(totals, from, to));
      let remaining = Math.max(
        0,
        debts.reduce((sum, debt) => sum + checkedCents(debt.outstanding), 0) - netDebt,
      );
      // `expenses` is read in creation order; stable sort preserves that order for equal dates.
      debts.sort((a, b) => a.date.localeCompare(b.date));
      for (const debt of debts) {
        const shareCents = checkedCents(debt.outstanding);
        const paidCents = Math.min(shareCents, remaining);
        debt.outstanding = (shareCents - paidCents) / 100;
        remaining -= paidCents;
      }
    }
    for (const [key, debts] of expenseDebts)
      expenseDebts.set(
        key,
        debts.filter((debt) => debt.outstanding > 0),
      );
    views[expenseView] = { byCurrency, expenseDebts, missingPayers };
  }
  return { roster, people, views, payments };
}

const settlementSummary = v.object({
  currencies: v.array(
    v.object({
      currency: v.string(),
      members: v.array(
        v.object({
          memberId: v.id("tabMembers"),
          name: v.string(),
          paid: v.number(),
          paidFor: v.number(),
          includedIn: v.number(),
          share: v.number(),
          balance: v.number(),
          balanceWithViewer: v.number(),
          hasSharedExpenseWithViewer: v.boolean(),
          expenses: v.array(
            v.object({
              expenseId: v.id("expenses"),
              expenseSlug: v.string(),
              name: v.string(),
              date: v.string(),
              outstanding: v.number(),
            }),
          ),
        }),
      ),
      suggestions: v.array(
        v.object({
          fromMemberId: v.id("tabMembers"),
          toMemberId: v.id("tabMembers"),
          amount: v.number(),
        }),
      ),
    }),
  ),
  missingPayers: v.array(v.object({ slug: v.string(), name: v.string() })),
  history: v.array(
    v.object({
      id: v.id("settlements"),
      fromMemberId: v.id("tabMembers"),
      toMemberId: v.id("tabMembers"),
      amount: v.number(),
      currency: v.string(),
      date: v.string(),
      note: v.optional(v.string()),
      reversed: v.boolean(),
      view: v.optional(expenseViewValidator),
    }),
  ),
  viewerMemberId: v.union(v.id("tabMembers"), v.null()),
});
const consolidatedSettlementResult = v.union(
  v.null(),
  v.object({ paid: settlementSummary, upcoming: settlementSummary, all: settlementSummary }),
);

export const get = query({
  args: {
    slug: v.string(),
    asOfDate: v.string(),
  },
  returns: consolidatedSettlementResult,
  handler: async (ctx, { slug, asOfDate }) => {
    if (!isValidISODate(asOfDate)) throw new Error("Use a real YYYY-MM-DD as-of date");
    const tab = await findTab(ctx, slug);
    if (!tab) return null;
    const viewer = await requireTabViewer(ctx, tab);
    const { roster, people, views, payments } = await readBalances(ctx, tab, asOfDate, viewer);
    const viewerMemberId = roster.find((seat) => seat.userId === viewer)?._id ?? null;
    const format = (expenseView: ExpenseView) => {
      const { byCurrency, expenseDebts, missingPayers } = views[expenseView];
      return {
        currencies: [...byCurrency]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([currency, totals]) => {
            const members = people.map((person) => {
              const total = totals.get(person.id)!;
              const directBalance =
                viewerMemberId === null || viewerMemberId === person.id
                  ? 0
                  : directBalanceWithViewer(totals, person.id, viewerMemberId);
              const key =
                directBalance > 0
                  ? expenseDebtKey(currency, person.id, viewerMemberId!)
                  : directBalance < 0
                    ? expenseDebtKey(currency, viewerMemberId!, person.id)
                    : "";
              return {
                memberId: person.id,
                name: person.name,
                paid: total.paidCents / 100,
                paidFor: total.paidForCount,
                includedIn: total.includedInCount,
                share: total.shareCents / 100,
                balance: net(total) / 100,
                balanceWithViewer:
                  viewerMemberId === null || viewerMemberId === person.id
                    ? net(total) / 100
                    : directBalance / 100,
                hasSharedExpenseWithViewer: total.hasSharedExpenseWithViewer,
                expenses: key ? (expenseDebts.get(key) ?? []) : [],
              };
            });
            return {
              currency,
              members,
              suggestions: suggestSettlements(members).map((suggestion) => ({
                ...suggestion,
                fromMemberId: suggestion.fromMemberId as Id<"tabMembers">,
                toMemberId: suggestion.toMemberId as Id<"tabMembers">,
              })),
            };
          }),
        missingPayers,
        history: payments
          .filter((payment) => payment.date <= asOfDate)
          .sort((a, b) => b.date.localeCompare(a.date) || b._creationTime - a._creationTime)
          .map((payment) => ({
            id: payment._id,
            fromMemberId: payment.fromMemberId,
            toMemberId: payment.toMemberId,
            amount: payment.amountCents / 100,
            currency: payment.currency,
            date: payment.date,
            note: payment.note,
            reversed: payment.reversedAt !== undefined,
            view: payment.view,
          })),
        viewerMemberId,
      };
    };
    return { paid: format("paid"), upcoming: format("upcoming"), all: format("all") };
  },
});

async function savePayments(
  ctx: MutationCtx,
  tab: Doc<"tabs">,
  userId: Id<"users">,
  asOfDate: string,
  view: ExpenseView,
  inputs: PaymentInput[],
) {
  if (inputs.length === 0) throw new Error("At least one payment is required");
  if (inputs.length > READ_LIMIT)
    throw new Error(`A payment batch can contain at most ${READ_LIMIT} payments`);
  const payments = inputs.map(normalizePayment);
  if (!isValidISODate(asOfDate)) throw new Error("Use a real YYYY-MM-DD as-of date");

  const requestIds = new Set<string>();
  const identities = new Set<string>();
  for (const payment of payments) {
    if (requestIds.has(payment.requestId)) throw new Error("Payment request ids must be unique");
    requestIds.add(payment.requestId);
    const identity = `${payment.currency}:${payment.fromMemberId}:${payment.toMemberId}`;
    if (identities.has(identity)) throw new Error("Payment member pairs must be unique");
    identities.add(identity);
  }

  const priorRows = await Promise.all(
    payments.map((payment) =>
      ctx.db
        .query("settlements")
        .withIndex("by_tabId_and_requestId", (q) =>
          q.eq("tabId", tab._id).eq("requestId", payment.requestId),
        )
        .unique(),
    ),
  );
  const pending: NormalizedPayment[] = [];
  for (const [index, payment] of payments.entries()) {
    const prior = priorRows[index];
    if (!prior) {
      pending.push(payment);
      continue;
    }
    if (!samePayment(prior, payment, view)) {
      throw new Error("This request id was already used for a different settlement");
    }
  }
  if (pending.length === 0) return null;

  // Browsers pass their local calendar date; all real time zones fall within
  // one date either side of UTC. Queries stay deterministic without a clock.
  const now = Date.now();
  const low = new Date(now - 86_400_000).toISOString().slice(0, 10);
  const high = new Date(now + 86_400_000).toISOString().slice(0, 10);
  if (asOfDate < low || asOfDate > high || pending.some((payment) => payment.date > asOfDate)) {
    throw new Error("Settlement date must not be after today; refresh and try again");
  }

  const { views, roster } = await readBalances(ctx, tab, asOfDate);
  const ids = new Set(roster.map((seat) => seat._id));
  for (const payment of pending) {
    if (!ids.has(payment.fromMemberId) || !ids.has(payment.toMemberId))
      throw new Error("Settlement members must belong to this tab");
    const totals = views[view].byCurrency.get(payment.currency) ?? blank(roster);
    const directBalance = directBalanceWithViewer(totals, payment.fromMemberId, payment.toMemberId);
    if (directBalance <= 0 || payment.amountCents > directBalance)
      throw new Error("Settlement amount exceeds the current amount owed");
  }

  for (const payment of pending) {
    await ctx.db.insert("settlements", {
      tabId: tab._id,
      fromMemberId: payment.fromMemberId,
      toMemberId: payment.toMemberId,
      amountCents: payment.amountCents,
      currency: payment.currency,
      date: payment.date,
      note: payment.note,
      recordedBy: userId,
      requestId: payment.requestId,
      view,
    });
  }
  return null;
}

export const record = mutation({
  args: {
    slug: v.string(),
    asOfDate: v.string(),
    ...paymentFields,
    view: v.optional(expenseViewValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tab = await findTab(ctx, args.slug);
    if (!tab) throw new Error("Tab not found");
    const userId = await requireTabViewer(ctx, tab);
    return await savePayments(ctx, tab, userId, args.asOfDate, args.view ?? "paid", [args]);
  },
});

export const recordMany = mutation({
  args: {
    slug: v.string(),
    asOfDate: v.string(),
    view: v.optional(expenseViewValidator),
    payments: v.array(paymentValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tab = await findTab(ctx, args.slug);
    if (!tab) throw new Error("Tab not found");
    const userId = await requireTabViewer(ctx, tab);
    return await savePayments(ctx, tab, userId, args.asOfDate, args.view ?? "paid", args.payments);
  },
});

export const reverse = mutation({
  args: { slug: v.string(), settlementId: v.id("settlements") },
  returns: v.null(),
  handler: async (ctx, { slug, settlementId }) => {
    const tab = await findTab(ctx, slug);
    if (!tab) throw new Error("Tab not found");
    const userId = await requireTabViewer(ctx, tab);
    const settlement = await ctx.db.get(settlementId);
    if (!settlement || settlement.tabId !== tab._id) throw new Error("Settlement not found");
    if (settlement.reversedAt === undefined) {
      await ctx.db.patch(settlementId, { reversedAt: Date.now(), reversedBy: userId });
    }
    return null;
  },
});
