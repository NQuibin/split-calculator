import type { Contribution, ExpenseItem, Person, RateSetting } from "./types";

export interface ItemLine {
  itemId: string;
  itemName: string;
  share: number;
  discountShare: number;
  taxShare: number;
  tipShare: number;
}

export interface PersonBreakdown {
  personId: string;
  name: string;
  itemsSubtotal: number;
  taxShare: number;
  tipShare: number;
  total: number;
  lines: ItemLine[];
}

export interface ItemBreakdown {
  itemId: string;
  itemName: string;
  cost: number;
  discountAmount: number;
  netCost: number;
  taxAmount: number;
  tipAmount: number;
  total: number;
}

export interface SplitResult {
  people: PersonBreakdown[];
  items: ItemBreakdown[];
  subtotal: number;
  taxTotal: number;
  tipTotal: number;
  grandTotal: number;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function rateAmount(rate: RateSetting, base: number): number {
  return rate.mode === "percent" ? base * (rate.value / 100) : rate.value;
}

export function discountAmount(item: ExpenseItem): number {
  return rateAmount(item.discount, item.cost);
}

function netCost(item: ExpenseItem): number {
  return Math.max(0, item.cost - discountAmount(item));
}

export function computeSplit(people: Person[], items: ExpenseItem[]): SplitResult {
  const subtotal = items.reduce((sum, item) => sum + netCost(item), 0);

  if (people.length === 0 || subtotal === 0) {
    return {
      people: people.map((p) => ({
        personId: p.id,
        name: p.name,
        itemsSubtotal: 0,
        taxShare: 0,
        tipShare: 0,
        total: 0,
        lines: [],
      })),
      items: items.map((item) => {
        const net = netCost(item);
        return {
          itemId: item.id,
          itemName: item.name,
          cost: round2(item.cost),
          discountAmount: round2(discountAmount(item)),
          netCost: round2(net),
          taxAmount: 0,
          tipAmount: 0,
          total: round2(net),
        };
      }),
      subtotal: 0,
      taxTotal: 0,
      tipTotal: 0,
      grandTotal: 0,
    };
  }

  const itemBreakdowns: ItemBreakdown[] = items.map((item) => {
    const net = netCost(item);
    const itemTax = rateAmount(item.tax, net);
    const itemTip = rateAmount(item.tip, net);
    return {
      itemId: item.id,
      itemName: item.name,
      cost: round2(item.cost),
      discountAmount: round2(discountAmount(item)),
      netCost: round2(net),
      taxAmount: round2(itemTax),
      tipAmount: round2(itemTip),
      total: round2(net + itemTax + itemTip),
    };
  });

  const raw = new Map<
    string,
    { itemsSubtotal: number; taxShare: number; tipShare: number; lines: ItemLine[] }
  >();
  for (const p of people) {
    raw.set(p.id, { itemsSubtotal: 0, taxShare: 0, tipShare: 0, lines: [] });
  }

  let taxTotal = 0;
  let tipTotal = 0;

  for (const item of items) {
    const itemCost = netCost(item);
    const itemTax = rateAmount(item.tax, itemCost);
    const itemTip = rateAmount(item.tip, itemCost);
    taxTotal += itemTax;
    tipTotal += itemTip;

    const sharers = item.splitWith.filter((id) => raw.has(id));
    const n = sharers.length;
    if (n === 0) continue;

    const appliedDiscount = item.cost - itemCost;
    const perPersonCost = itemCost / n;
    const perPersonDiscount = appliedDiscount / n;
    const perPersonTax = itemTax / n;
    const perPersonTip = itemTip / n;

    for (const personId of sharers) {
      const entry = raw.get(personId)!;
      entry.itemsSubtotal += perPersonCost;
      entry.taxShare += perPersonTax;
      entry.tipShare += perPersonTip;
      entry.lines.push({
        itemId: item.id,
        itemName: item.name,
        share: round2(perPersonCost),
        discountShare: round2(perPersonDiscount),
        taxShare: round2(perPersonTax),
        tipShare: round2(perPersonTip),
      });
    }
  }

  const grandTotalRaw = subtotal + taxTotal + tipTotal;
  const grandTotal = round2(grandTotalRaw);

  const rows = people.map((p) => {
    const entry = raw.get(p.id)!;
    const totalRaw = entry.itemsSubtotal + entry.taxShare + entry.tipShare;
    return { person: p, entry, totalRaw };
  });

  const roundedTotals = rows.map((r) => round2(r.totalRaw));
  const roundedSum = round2(roundedTotals.reduce((s, v) => s + v, 0));
  const centsDiff = Math.round((grandTotal - roundedSum) * 100);

  if (centsDiff !== 0) {
    const order = rows
      .map((r, idx) => ({ idx, totalRaw: r.totalRaw }))
      .sort((a, b) => b.totalRaw - a.totalRaw);
    const step = centsDiff > 0 ? 0.01 : -0.01;
    for (let i = 0; i < Math.abs(centsDiff); i++) {
      const target = order[i % order.length].idx;
      roundedTotals[target] = round2(roundedTotals[target] + step);
    }
  }

  const peopleBreakdown: PersonBreakdown[] = rows.map((r, idx) => ({
    personId: r.person.id,
    name: r.person.name,
    itemsSubtotal: round2(r.entry.itemsSubtotal),
    taxShare: round2(r.entry.taxShare),
    tipShare: round2(r.entry.tipShare),
    total: roundedTotals[idx],
    lines: r.entry.lines,
  }));

  return {
    people: peopleBreakdown,
    items: itemBreakdowns,
    subtotal: round2(subtotal),
    taxTotal: round2(taxTotal),
    tipTotal: round2(tipTotal),
    grandTotal,
  };
}

export interface SettlementRow {
  personId: string;
  name: string;
  contributed: number;
  fairShare: number;
  /** contributed - fairShare: positive means owed money back, negative means still needs to front more. */
  balance: number;
}

export function computeSettlement(contributions: Contribution[], split: SplitResult): SettlementRow[] {
  return split.people.map((p) => {
    const contribution = contributions.find((c) => c.personId === p.personId)?.amount;
    const contributed = contribution
      ? round2(rateAmount(contribution, split.grandTotal))
      : 0;
    return {
      personId: p.personId,
      name: p.name,
      contributed,
      fairShare: p.total,
      balance: round2(contributed - p.total),
    };
  });
}
