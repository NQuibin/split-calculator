import { expect, test } from "vitest";
import { isUpcoming, toISODate } from "./format";

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
