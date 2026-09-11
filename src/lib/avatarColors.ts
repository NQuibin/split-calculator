/**
 * 24 tinted pairs, one every 15 degrees of OKLCH hue, generated at a fixed
 * lightness (tint 0.905, initials ~0.49) with chroma clamped to the sRGB gamut
 * per hue - so the set reads as one family rather than drifting lighter through
 * the yellows or darker through the blues. Every pair clears WCAG AA on its own
 * tint (4.80:1 at worst), and the tints sit far enough off --paper/--surface to
 * register as a filled circle. Keep them in hue order; `avatarColorIndex`
 * scatters ids across the list, so adjacency here costs nothing.
 */
export const avatarColors = [
  "bg-[#fcd4d3] text-[#9e3d42]",
  "bg-[#fcd6cc] text-[#9e4029]",
  "bg-[#fad8c6] text-[#9a4602]",
  "bg-[#f5dac1] text-[#8a5100]",
  "bg-[#f0ddbf] text-[#7c5700]",
  "bg-[#e9e0bf] text-[#715e00]",
  "bg-[#e1e3c1] text-[#636300]",
  "bg-[#d9e5c5] text-[#4e6800]",
  "bg-[#d1e8cb] text-[#2d6d1d]",
  "bg-[#c9e9d3] text-[#006f3d]",
  "bg-[#c3eadb] text-[#006d54]",
  "bg-[#bfeae3] text-[#006b62]",
  "bg-[#bee9eb] text-[#006b70]",
  "bg-[#bfe8f2] text-[#00697b]",
  "bg-[#c2e6f8] text-[#006789]",
  "bg-[#c8e4fc] text-[#00649f]",
  "bg-[#cfe1fe] text-[#305da7]",
  "bg-[#d6defe] text-[#4c57a9]",
  "bg-[#dfdbfc] text-[#6150a4]",
  "bg-[#e6d9f8] text-[#734b9c]",
  "bg-[#edd7f3] text-[#81468f]",
  "bg-[#f4d5ec] text-[#8d417f]",
  "bg-[#f8d4e4] text-[#963d6c]",
  "bg-[#fbd4db] text-[#9c3c58]",
];

/**
 * FNV-1a over the id's code points. A plain code-point sum (what this used to
 * be) ignores character order and moves by one per id, which was survivable
 * across 5 colours because `% 5` hopped between unrelated entries - but with 24
 * hue-ordered colours it walks sequential ids straight along the hue circle:
 * the `person-N` ids that local drafts generate (see `expenseDraft.ts`) came
 * out as indices 13,14,15,... and so as near-identical neighbouring hues.
 * Mixing the bits decorrelates those without needing the palette reordered.
 */
export function avatarColorIndex(id: string): number {
  let hash = 0x811c9dc5;
  for (const char of id) {
    hash ^= char.codePointAt(0)!;
    // imul keeps the 32-bit FNV prime multiply from losing precision to float64.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % avatarColors.length;
}
