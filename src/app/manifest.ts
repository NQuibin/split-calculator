import type { MetadataRoute } from "next";
import { BASE_PATH } from "@/lib/basePath";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Split Calculator",
    short_name: "Split Calc",
    description: "Itemize any receipt — restaurant, grocery, or service — and split it fairly.",
    // No trailing slash: this app is served under nquibin.dev via a rewrite,
    // and the exact no-trailing-slash path is the one known to resolve there.
    start_url: BASE_PATH,
    scope: `${BASE_PATH}/`,
    display: "standalone",
    background_color: "#edf1e4",
    theme_color: "#2f4a3c",
    icons: [
      { src: `${BASE_PATH}/pwa-icon-192`, sizes: "192x192", type: "image/png" },
      { src: `${BASE_PATH}/pwa-icon-512`, sizes: "512x512", type: "image/png" },
      {
        src: `${BASE_PATH}/pwa-icon-512-maskable`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
