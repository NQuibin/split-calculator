// Renders the PWA/Apple icons to static PNGs in public/.
//
// Nothing about them varies per request, so they're baked once at build time:
// public/icon.svg is the single source of truth for the mark, and resvg
// rasterizes it at each size.
//
// Run via `pnpm icons`; `pnpm build` runs it first.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const publicDir = fileURLToPath(new URL("../public/", import.meta.url));

const PAPER = "#edf1e4";

// The pin's own artwork, lifted out of public/icon.svg's <svg> wrapper so it
// can be re-wrapped at a different scale. It is drawn on a 0-512 grid.
const GRID = 512;
const mark = readFileSync(`${publicDir}icon.svg`, "utf8").replace(
  /^[\s\S]*?<svg[^>]*>|<\/svg>\s*$/g,
  "",
);

// The pin is transparent and top-heavy; PNG launchers paint it on whatever
// they like, so give every raster an opaque paper ground and centre the mark
// at `scale` of the canvas (maskable needs to clear the 80% safe zone).
function compose(scale: number): string {
  const offset = (GRID * (1 - scale)) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}">
  <rect width="${GRID}" height="${GRID}" fill="${PAPER}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">${mark}</g>
</svg>`;
}

function render(name: string, size: number, scale: number) {
  const png = new Resvg(compose(scale), { fitTo: { mode: "width", value: size } }).render().asPng();
  writeFileSync(`${publicDir}${name}`, png);
  console.log(`  ${name} (${size}x${size}, ${(png.length / 1024).toFixed(1)}kB)`);
}

console.log("Rendering app icons:");
render("apple-icon.png", 180, 0.86);
render("pwa-icon-192.png", 192, 0.86);
render("pwa-icon-512.png", 512, 0.86);
// Maskable icons get cropped to the launcher's mask, so keep the mark inside
// the 80%-of-canvas safe zone.
render("pwa-icon-512-maskable.png", 512, 0.62);
