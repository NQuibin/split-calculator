import { describe, expect, it } from "vitest";
import { avatarColorIndex } from "./avatarColors";

const PALETTE_SIZE = 24;

function convexLikeId(seed: number): string {
  // Convex document ids are long, random, lowercase alphanumeric. xorshift32
  // (seeded off a scrambled counter, then warmed) keeps successive ids
  // uncorrelated - an LCG's low bits are too structured to stand in for random
  // ids, and would test the generator rather than the hash.
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let state = Math.imul(seed + 1, 0x9e3779b1) >>> 0 || 1;
  const next = () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state;
  };
  for (let i = 0; i < 8; i++) next();
  return Array.from({ length: 32 }, () => alphabet[next() % alphabet.length]).join("");
}

describe("avatarColorIndex", () => {
  it("is deterministic and stays inside the palette", () => {
    for (let i = 0; i < 500; i++) {
      const id = convexLikeId(i);
      const index = avatarColorIndex(id);
      expect(index).toBe(avatarColorIndex(id));
      expect(Number.isInteger(index)).toBe(true);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(PALETTE_SIZE);
    }
  });

  it("reaches every colour in the palette", () => {
    const seen = new Set(Array.from({ length: 2000 }, (_, i) => avatarColorIndex(convexLikeId(i))));
    expect(seen.size).toBe(PALETTE_SIZE);
  });

  it("keeps the sequential draft ids off neighbouring hues", () => {
    // `expenseDraft` falls back to `person-1`, `person-2`, ... for local drafts.
    // A code-point sum mapped these to consecutive indices, which in a
    // hue-ordered palette meant visually indistinguishable avatars.
    const indices = Array.from({ length: 9 }, (_, i) => avatarColorIndex(`person-${i + 1}`));
    expect(new Set(indices).size).toBe(indices.length);
    // The run is what hurt: consecutive indices are 15 degrees of hue apart, so
    // a walk along them produced a row of avatars nobody could tell apart. An
    // occasional adjacent pair is inherent to scattering ids and is fine; a
    // sorted-and-contiguous block is the regression to catch.
    const sorted = [...indices].sort((a, b) => a - b);
    const contiguous = sorted.every((value, i) => i === 0 || value === sorted[i - 1] + 1);
    expect(contiguous).toBe(false);
    // And the first few should still span a decent part of the circle.
    const firstFour = indices.slice(0, 4);
    expect(Math.max(...firstFour) - Math.min(...firstFour)).toBeGreaterThan(4);
  });

  it("depends on character order, unlike a code-point sum", () => {
    expect(avatarColorIndex("abcdef")).not.toBe(avatarColorIndex("bacdef"));
  });

  it("spreads ids roughly evenly across the palette", () => {
    const buckets = new Array(PALETTE_SIZE).fill(0);
    const total = 12000;
    for (let i = 0; i < total; i++) buckets[avatarColorIndex(convexLikeId(i))]++;
    const expected = total / PALETTE_SIZE;
    // Chi-square over 23 degrees of freedom; 52.2 is the p=0.0005 critical
    // value, so a healthy hash clears this with room to spare.
    const chiSquare = buckets.reduce((acc, count) => acc + (count - expected) ** 2 / expected, 0);
    expect(chiSquare).toBeLessThan(52.2);
  });
});
