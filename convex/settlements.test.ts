/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { toExpenseStateArgs } from "../src/lib/expenseSync";

const modules = import.meta.glob("./**/*.ts");
const zero = { mode: "amount" as const, value: 0 };
const TODAY = "2026-09-12";
beforeEach(() => vi.useFakeTimers({ now: new Date(`${TODAY}T12:00:00Z`), toFake: ["Date"] }));
afterEach(() => vi.useRealTimers());
const state = (
  payerId?: string,
  currency = "USD",
  date = TODAY,
  splitWith = ["a", "b", "c"],
  cost = 120,
) => ({
  name: "Dinner",
  mode: "simple" as const,
  date,
  currency,
  payerId,
  people: [
    { id: "a", name: "Alex" },
    { id: "b", name: "Bea" },
    { id: "c", name: "Cam" },
  ],
  items: [{ id: "total", name: "Dinner", cost, splitWith, discount: zero, tax: zero, tip: zero }],
});
async function setup() {
  const t = convexTest(schema, modules);
  const ownerId = await t.run((ctx) => ctx.db.insert("users", { name: "Alex" }));
  const outsiderId = await t.run((ctx) => ctx.db.insert("users", { name: "Out" }));
  const owner = t.withIdentity({ subject: `${ownerId}|session` }),
    outsider = t.withIdentity({ subject: `${outsiderId}|session` });
  await owner.mutation(api.tabs.create, {
    slug: "trip",
    name: "Trip",
    memberNames: ["Bea", "Cam"],
  });
  const tab = (await owner.query(api.tabs.getBySlug, { slug: "trip" }))!;
  return { t, owner, outsider, members: tab.members };
}
async function expense(
  owner: Awaited<ReturnType<typeof setup>>["owner"],
  members: { id: string }[],
  payerId?: string,
  currency?: string,
  splitWith?: string[],
  cost?: number,
  expenseSlug = "dinner",
) {
  await owner.mutation(api.tabs.createExpense, {
    tabSlug: "trip",
    expenseSlug,
    state: state(payerId, currency, TODAY, splitWith, cost),
    memberMapping: [
      { personId: "a", memberId: members[0].id },
      { personId: "b", memberId: members[1].id },
      { personId: "c", memberId: members[2].id },
    ],
  });
}

test("missing, empty, and foreign payers are rejected when creating an expense", async () => {
  const { owner, members } = await setup();
  await expect(expense(owner, members, undefined)).rejects.toThrow(
    "Choose who paid before saving the expense",
  );
  await expect(expense(owner, members, "")).rejects.toThrow(
    "Choose who paid before saving the expense",
  );
  await expect(expense(owner, members, "foreign")).rejects.toThrow("Payer must belong to this tab");
});

test("record is authorized, exact, idempotent, guarded, and reversible", async () => {
  const { owner, outsider, members } = await setup();
  await expense(owner, members, members[0].id);
  const args = {
    slug: "trip",
    fromMemberId: members[1].id,
    toMemberId: members[0].id,
    amount: 40,
    currency: "USD",
    date: "2026-09-12",
    requestId: "pay-1",
    asOfDate: "2026-09-12",
  };
  await expect(
    outsider.query(api.settlements.get, { slug: "trip", asOfDate: "2026-09-12" }),
  ).rejects.toThrow("Not authorized");
  await expect(outsider.mutation(api.settlements.record, args)).rejects.toThrow("Not authorized");
  await expect(
    owner.mutation(api.settlements.record, { ...args, amount: 40.001, requestId: "bad" }),
  ).rejects.toThrow("two decimal");
  await expect(
    owner.mutation(api.settlements.record, { ...args, amount: -1, requestId: "negative" }),
  ).rejects.toThrow("positive");
  await owner.mutation(api.settlements.record, args);
  await owner.mutation(api.settlements.record, args);
  await expect(owner.mutation(api.settlements.record, { ...args, amount: 39 })).rejects.toThrow(
    "different settlement",
  );
  await expect(
    owner.mutation(api.settlements.record, { ...args, requestId: "too-much", amount: 40.01 }),
  ).rejects.toThrow("exceeds");
  const first = (await owner.query(api.settlements.get, { slug: "trip", asOfDate: "2026-09-12" }))!;
  expect(first.paid.history).toHaveLength(1);
  expect(first.paid.currencies[0].members.map((m) => m.balance)).toEqual([40, 0, -40]);
  await owner.mutation(api.settlements.reverse, {
    slug: "trip",
    settlementId: first.paid.history[0].id,
  });
  await owner.mutation(api.settlements.reverse, {
    slug: "trip",
    settlementId: first.paid.history[0].id,
  });
  const reversed = (await owner.query(api.settlements.get, {
    slug: "trip",
    asOfDate: "2026-09-12",
  }))!;
  expect(reversed.paid.history[0].reversed).toBe(true);
  expect(reversed.paid.currencies[0].members.map((m) => m.balance)).toEqual([80, -40, -40]);
});

test("rejects cross-tab members and retains a payment-only currency after expense deletion", async () => {
  const { owner, members } = await setup();
  await expense(owner, members, members[0].id, "EUR");
  await owner.mutation(api.settlements.record, {
    slug: "trip",
    fromMemberId: members[1].id,
    toMemberId: members[0].id,
    amount: 40,
    currency: "EUR",
    date: "2026-09-12",
    requestId: "eur",
    asOfDate: "2026-09-12",
  });
  await owner.mutation(api.tabs.create, { slug: "other", name: "Other", memberNames: [] });
  const other = (await owner.query(api.tabs.getBySlug, { slug: "other" }))!;
  await expect(
    owner.mutation(api.settlements.record, {
      slug: "trip",
      fromMemberId: other.members[0].id,
      toMemberId: members[0].id,
      amount: 1,
      currency: "EUR",
      date: "2026-09-12",
      requestId: "cross",
      asOfDate: "2026-09-12",
    }),
  ).rejects.toThrow("belong");
  await owner.mutation(api.expenses.remove, { slug: "dinner" });
  const result = (await owner.query(api.settlements.get, {
    slug: "trip",
    asOfDate: "2026-09-12",
  }))!;
  expect(result.paid.currencies.map((c) => c.currency)).toEqual(["EUR"]);
  expect(result.paid.currencies[0].members.map((m) => m.balance)).toEqual([-40, 40, 0]);
});

test("payer is remapped on create, survives reload, and protects its seat", async () => {
  const { owner, members } = await setup();
  await expense(owner, members, "c", "USD", ["a", "b"]);
  const loaded = (await owner.query(api.expenses.get, { slug: "dinner" }))!;
  expect(loaded.payerId).toBe(members[2].id);
  await expect(
    owner.mutation(api.tabs.removeMember, { slug: "trip", memberId: members[2].id }),
  ).rejects.toThrow("payer");
  await expect(
    owner.mutation(api.expenses.save, {
      slug: "dinner",
      state: { ...toExpenseStateArgs(loaded), payerId: undefined },
    }),
  ).rejects.toThrow("Choose who paid before saving the expense");
  await expect(
    owner.mutation(api.expenses.save, {
      slug: "dinner",
      state: { ...toExpenseStateArgs(loaded), payerId: "" },
    }),
  ).rejects.toThrow("Choose who paid before saving the expense");
  await expect(
    owner.mutation(api.expenses.save, {
      slug: "dinner",
      state: { ...toExpenseStateArgs(loaded), payerId: "foreign" },
    }),
  ).rejects.toThrow("Payer must belong to this tab");
  expect((await owner.query(api.expenses.get, { slug: "dinner" }))!.payerId).toBe(members[2].id);
});

test("partial payment keeps expense paid separate and edits recompute the debt", async () => {
  const { owner, members } = await setup();
  await expense(owner, members, members[0].id);
  await owner.mutation(api.settlements.record, {
    slug: "trip",
    fromMemberId: members[1].id,
    toMemberId: members[0].id,
    amount: 15,
    currency: "USD",
    date: TODAY,
    requestId: "partial",
    asOfDate: TODAY,
  });
  let result = (await owner.query(api.settlements.get, { slug: "trip", asOfDate: TODAY }))!;
  expect(result.paid.currencies[0].members.map((m) => [m.paid, m.balance])).toEqual([
    [120, 65],
    [0, -25],
    [0, -40],
  ]);
  const loaded = (await owner.query(api.expenses.get, { slug: "dinner" }))!;
  await owner.mutation(api.expenses.save, {
    slug: "dinner",
    state: { ...toExpenseStateArgs(loaded), items: [{ ...loaded.items[0], cost: 90 }] },
  });
  result = (await owner.query(api.settlements.get, { slug: "trip", asOfDate: TODAY }))!;
  expect(result.paid.currencies[0].members.map((m) => m.balance)).toEqual([45, -15, -30]);
});

test("invalid dates, currency and precision are refused before creating a settlement", async () => {
  const { owner, members } = await setup();
  await expense(owner, members, members[0].id);
  const base = {
    slug: "trip",
    fromMemberId: members[1].id,
    toMemberId: members[0].id,
    amount: 1,
    currency: "USD",
    date: TODAY,
    requestId: "x",
    asOfDate: TODAY,
  };
  await expect(
    owner.mutation(api.settlements.record, { ...base, date: "2026-02-30" }),
  ).rejects.toThrow("real YYYY");
  await expect(
    owner.mutation(api.settlements.record, { ...base, currency: "ZZZ" }),
  ).rejects.toThrow("supported currency");
  await expect(owner.mutation(api.settlements.record, { ...base, amount: 0.001 })).rejects.toThrow(
    "two decimal",
  );
  await expect(owner.mutation(api.settlements.record, { ...base, amount: 0 })).rejects.toThrow(
    "positive",
  );
  await expect(
    owner.mutation(api.settlements.record, { ...base, date: "2026-09-13" }),
  ).rejects.toThrow("after today");
});

test("expense views separate expected future balances from paid balances", async () => {
  const { owner, members } = await setup();
  await expense(owner, members, members[0].id, "EUR", undefined, 120);
  await owner.mutation(api.tabs.setExpenseExchangeRate, {
    slug: "trip",
    expenseSlug: "dinner",
    from: "EUR",
    to: "USD",
    rate: 1.333,
  });
  await expense(owner, members, members[0].id, "USD", undefined, 90, "future");
  const future = (await owner.query(api.expenses.get, { slug: "future" }))!;
  await owner.mutation(api.expenses.save, {
    slug: "future",
    state: { ...toExpenseStateArgs(future), date: "2026-09-13" },
  });
  const result = (await owner.query(api.settlements.get, { slug: "trip", asOfDate: TODAY }))!;
  expect(result.paid.currencies.map((c) => c.currency)).toEqual(["USD"]);
  expect(result.paid.currencies[0].members.reduce((sum, m) => sum + m.share, 0)).toBe(159.96);
  expect(result.paid.currencies[0].members.reduce((sum, m) => sum + m.balance, 0)).toBe(0);
  const upcoming = result.upcoming;
  expect(upcoming.currencies[0].members.map((member) => member.balance)).toEqual([60, -30, -30]);
  expect(upcoming.history).toEqual([]);
  const all = result.all;
  expect(all.currencies[0].members.reduce((sum, member) => sum + member.balance, 0)).toBe(0);
  expect(all.currencies[0].members.map((member) => member.balance)).toEqual([
    166.64, -83.32, -83.32,
  ]);
});

test("included expense counts follow each selected expense view", async () => {
  const { owner, members } = await setup();
  await expense(owner, members, members[0].id, "USD", ["a", "b"]);
  await expense(owner, members, members[0].id, "USD", ["b", "c"], 90, "future");
  const future = (await owner.query(api.expenses.get, { slug: "future" }))!;
  await owner.mutation(api.expenses.save, {
    slug: "future",
    state: { ...toExpenseStateArgs(future), date: "2026-09-13" },
  });

  const result = (await owner.query(api.settlements.get, { slug: "trip", asOfDate: TODAY }))!;
  expect(result.paid.currencies[0].members.map((member) => member.includedIn)).toEqual([1, 1, 0]);
  expect(result.upcoming.currencies[0].members.map((member) => member.includedIn)).toEqual([
    0, 1, 1,
  ]);
  expect(result.all.currencies[0].members.map((member) => member.includedIn)).toEqual([1, 2, 1]);
});

test("view-scoped payments affect the selected future balances and remain in every history", async () => {
  const { owner, members } = await setup();
  await expense(owner, members, members[0].id, "USD", undefined, 120);
  await expense(owner, members, members[0].id, "USD", undefined, 90, "future");
  const future = (await owner.query(api.expenses.get, { slug: "future" }))!;
  await owner.mutation(api.expenses.save, {
    slug: "future",
    state: { ...toExpenseStateArgs(future), date: "2026-09-13" },
  });

  await owner.mutation(api.settlements.record, {
    slug: "trip",
    fromMemberId: members[1].id,
    toMemberId: members[0].id,
    amount: 10,
    currency: "USD",
    date: TODAY,
    requestId: "paid-payment",
    asOfDate: TODAY,
  });
  await owner.mutation(api.settlements.record, {
    slug: "trip",
    fromMemberId: members[1].id,
    toMemberId: members[0].id,
    amount: 20,
    currency: "USD",
    date: TODAY,
    requestId: "upcoming-payment",
    asOfDate: TODAY,
    view: "upcoming",
  });

  const result = (await owner.query(api.settlements.get, { slug: "trip", asOfDate: TODAY }))!;
  expect(result.paid.currencies[0].members.map((member) => member.balance)).toEqual([70, -30, -40]);
  expect(result.upcoming.currencies[0].members.map((member) => member.balance)).toEqual([
    40, -10, -30,
  ]);
  expect(result.all.currencies[0].members.map((member) => member.balance)).toEqual([110, -40, -70]);
  expect(result.paid.history).toHaveLength(2);
  expect(result.upcoming.history).toHaveLength(2);
  expect(result.all.history).toHaveLength(2);
  expect(result.upcoming.history.map((payment) => payment.view)).toEqual(["upcoming", "paid"]);
});

test("returns direct viewer balances without transitive third-party netting", async () => {
  const { owner, members } = await setup();
  await expense(owner, members, members[0].id, "USD", undefined, 9, "viewer-one");
  await expense(owner, members, members[0].id, "USD", undefined, 9, "viewer-two");
  await expense(owner, members, members[1].id, "USD", ["b", "c"], 6, "p2-pays");

  let result = (await owner.query(api.settlements.get, { slug: "trip", asOfDate: TODAY }))!;
  const currency = result.paid.currencies[0];
  expect(currency.members.map((member) => [member.balance, member.balanceWithViewer])).toEqual([
    [12, 12],
    [-3, 6],
    [-9, 6],
  ]);

  await owner.mutation(api.settlements.record, {
    slug: "trip",
    fromMemberId: members[1].id,
    toMemberId: members[0].id,
    amount: 2,
    currency: "USD",
    date: TODAY,
    requestId: "p2-pays-viewer",
    asOfDate: TODAY,
  });
  result = (await owner.query(api.settlements.get, { slug: "trip", asOfDate: TODAY }))!;
  expect(
    result.paid.currencies[0].members.map((member) => [member.balance, member.balanceWithViewer]),
  ).toEqual([
    [10, 10],
    [-1, 4],
    [-9, 6],
  ]);
});

test("claiming a payer preserves balances and gives the claimant read-only access", async () => {
  const { t, owner, outsider, members } = await setup();
  await expense(owner, members, "c", "USD", ["a", "b"]);
  const before = (await owner.query(api.settlements.get, { slug: "trip", asOfDate: TODAY }))!;
  expect(before.paid.currencies[0].members.map((member) => member.balance)).toEqual([
    -60, -60, 120,
  ]);
  const invites = await owner.query(api.tabs.getInviteLinks, { slug: "trip" });
  const invite = invites.find((link) => link.memberId === members[2].id)!;
  await outsider.mutation(api.tabs.claimMember, { slug: "trip", token: invite.token });
  const claimed = (await outsider.query(api.settlements.get, { slug: "trip", asOfDate: TODAY }))!;
  expect(claimed.paid.viewerMemberId).toBe(members[2].id);
  expect(claimed.paid.currencies[0].members.map((member) => member.balance)).toEqual([
    -60, -60, 120,
  ]);
  await owner.mutation(api.settlements.record, {
    slug: "trip",
    fromMemberId: members[0].id,
    toMemberId: members[2].id,
    amount: 60,
    currency: "USD",
    date: TODAY,
    requestId: "claimed",
    asOfDate: TODAY,
  });
  const paid = (await outsider.query(api.settlements.get, { slug: "trip", asOfDate: TODAY }))!
    .paid!;
  await expect(
    outsider.mutation(api.settlements.reverse, { slug: "trip", settlementId: paid.history[0].id }),
  ).rejects.toThrow("Not authorized");
  await owner.mutation(api.expenses.remove, { slug: "dinner" });
  await expect(
    owner.mutation(api.tabs.removeMember, { slug: "trip", memberId: members[2].id }),
  ).rejects.toThrow("settlement");
  await owner.mutation(api.tabs.deleteTab, { slug: "trip" });
  expect(await t.run((ctx) => ctx.db.query("settlements").take(1))).toEqual([]);
});

test("saved rates apply once and a changed tab currency preserves original repayments", async () => {
  const { owner, members } = await setup();
  await expense(owner, members, "a", "EUR", undefined, 11);
  await owner.mutation(api.tabs.setExpenseExchangeRate, {
    slug: "trip",
    expenseSlug: "dinner",
    from: "EUR",
    to: "USD",
    rate: 1.333,
  });
  const converted = (await owner.query(api.settlements.get, { slug: "trip", asOfDate: TODAY }))!;
  const convertedRows = converted.paid.currencies[0].members;
  expect(convertedRows.reduce((sum, member) => sum + Math.round(member.balance * 100), 0)).toBe(0);
  expect(convertedRows.reduce((sum, member) => sum + Math.round(member.share * 100), 0)).toBe(1466);
  await owner.mutation(api.settlements.record, {
    slug: "trip",
    fromMemberId: members[1].id,
    toMemberId: members[0].id,
    amount: 1,
    currency: "USD",
    date: TODAY,
    requestId: "fx",
    asOfDate: TODAY,
  });
  await owner.mutation(api.tabs.setDefaultCurrency, { slug: "trip", currency: "CAD" });
  const changed = (await owner.query(api.settlements.get, { slug: "trip", asOfDate: TODAY }))!;
  expect(changed.paid.currencies.map((group) => group.currency)).toEqual(["EUR", "USD"]);
  expect(changed.paid.currencies[1].members.map((member) => member.balance)).toEqual([-1, 1, 0]);
  await owner.mutation(api.tabs.create, { slug: "other", name: "Other", memberNames: [] });
  await expect(
    owner.mutation(api.settlements.reverse, {
      slug: "other",
      settlementId: changed.paid.history[0].id,
    }),
  ).rejects.toThrow("Settlement not found");
});

test("empty or repeated split members cannot create a payable expense", async () => {
  const { owner, members } = await setup();
  await expect(expense(owner, members, "a", "USD", [])).rejects.toThrow("at least one");
  await expect(expense(owner, members, "a", "USD", ["a", "a"])).rejects.toThrow(
    "same member twice",
  );
});
