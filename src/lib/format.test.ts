import { expect, test } from "vitest";
import {
  currency,
  formatExpenseDate,
  formatExpenseDateShort,
  isUpcoming,
  toISODate,
} from "./format";
import { DEFAULT_LOCALE, localeForCurrency } from "./locale";

function daysFromToday(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return toISODate(date);
}

test("an expense is upcoming only once its date is past today", () => {
  expect(isUpcoming(daysFromToday(1))).toBe(true);
  expect(isUpcoming(daysFromToday(365))).toBe(true);
  // Today's expense has been charged - it isn't upcoming.
  expect(isUpcoming(daysFromToday(0))).toBe(false);
  expect(isUpcoming(daysFromToday(-1))).toBe(false);
  expect(isUpcoming(undefined)).toBe(false);
  expect(isUpcoming("")).toBe(false);
});

test("upcoming compares calendar dates, not string length or UTC instants", () => {
  // A naive `new Date(str)` reads these as UTC midnight, which lands in
  // "yesterday" for western timezones; the comparison here is on local dates.
  expect(isUpcoming("2020-01-01")).toBe(false);
  expect(isUpcoming("9999-12-31")).toBe(true);
});

test("compact expense dates pad single-digit days", () => {
  expect(formatExpenseDateShort("2026-09-08")).toBe("Sep 08");
});

test("uses the user's default currency to choose a display locale", () => {
  const locale = localeForCurrency("CAD");

  expect(locale).toBe("en-CA");
  expect(currency(1234.56, "CAD", locale)).toBe("$1,234.56");
  expect(formatExpenseDate("2026-09-08", locale)).toBe("Sep 8, 2026");
  expect(formatExpenseDateShort("2026-09-08", locale)).toBe("Sep 08");
});

test("unknown currencies use the stable fallback locale", () => {
  expect(localeForCurrency("ZZZ")).toBe(DEFAULT_LOCALE);
  expect(localeForCurrency(undefined)).toBe(DEFAULT_LOCALE);
});
