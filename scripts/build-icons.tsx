// Renders the PWA/Apple icons to static PNGs in public/.
//
// Next generated these per-request from `next/og` route handlers
// (app/apple-icon.tsx, app/pwa-icon-*/route.tsx). Nothing about them varies
// per request, so a static SPA just bakes them once at build time - satori
// (which is what next/og wraps) plus resvg do the same job here.
//
// Run via `pnpm icons`; `pnpm build` runs it first.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { CalculatorIcon } from "../src/lib/appIcon";

const outDir = fileURLToPath(new URL("../public/", import.meta.url));

// The icon is pure geometry - no text - so satori needs no real font data,
// but it still requires a non-empty fonts array.
const fonts: [] = [];

async function render(name: string, size: number, fullBleed = false) {
  const svg = await satori(<CalculatorIcon size={size} fullBleed={fullBleed} />, {
    width: size,
    height: size,
    fonts,
  });
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
  writeFileSync(`${outDir}${name}`, png);
  console.log(`  ${name} (${size}x${size}, ${(png.length / 1024).toFixed(1)}kB)`);
}

console.log("Rendering app icons:");
await render("apple-icon.png", 180, true);
await render("pwa-icon-192.png", 192);
await render("pwa-icon-512.png", 512);
await render("pwa-icon-512-maskable.png", 512);
