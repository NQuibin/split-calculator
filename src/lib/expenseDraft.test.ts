import { expect, test } from "vitest";
import { encodeDraftParams, draftFromParams } from "./expenseDraft";

test("a draft round-trips its people through the URL", () => {
  const people = [
    { id: "person-1", name: "Alex" },
    { id: "ks7abc", name: "Sam" },
  ];
  const params = encodeDraftParams(people);
  expect(params.get("count")).toBe("2");
  expect(params.get("names")).toBe("Alex,Sam");
  // Only real ids are carried; generated ones are rebuilt on the far side.
  expect(params.get("ids")).toBe("person-1,ks7abc");

  expect(draftFromParams(params)!.people).toEqual(people);
});

test("generated ids are left out and rebuilt by position", () => {
  const params = encodeDraftParams([
    { id: "person-1", name: "Alex" },
    { id: "person-2", name: "Sam" },
  ]);
  expect(params.get("ids")).toBeNull();
  expect(draftFromParams(params)!.people).toEqual([
    { id: "person-1", name: "Alex" },
    { id: "person-2", name: "Sam" },
  ]);
});

test("a link shared without names still resolves, positionally", () => {
  // Shape of a link from before `names` was always written.
  const draft = draftFromParams(new URLSearchParams({ count: "3" }));
  expect(draft!.people).toEqual([
    { id: "person-1", name: "Person 1" },
    { id: "person-2", name: "Person 2" },
    { id: "person-3", name: "Person 3" },
  ]);
});

test("names with commas and unicode survive the round trip", () => {
  const people = [
    { id: "person-1", name: "Ann, Jr." },
    { id: "person-2", name: "José 🎉" },
  ];
  expect(draftFromParams(encodeDraftParams(people))!.people).toEqual(people);
});

test("a malformed count yields no draft", () => {
  expect(draftFromParams(new URLSearchParams({ count: "0" }))).toBeNull();
  expect(draftFromParams(new URLSearchParams({ count: "nope" }))).toBeNull();
  expect(draftFromParams(new URLSearchParams())).toBeNull();
});
