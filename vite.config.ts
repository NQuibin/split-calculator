import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { fileURLToPath } from "node:url";
import { BASE_PATH } from "./src/lib/basePath";

export default defineConfig({
  // The app is served under nquibin.dev via a rewrite, so every asset URL and
  // every route has to carry this prefix.
  base: `${BASE_PATH}/`,
  build: {
    // `base` only rewrites the URLs written into index.html - it does not
    // move the emitted files, and the nquibin.dev rewrite forwards to the
    // prefixed path on the deployment itself. Nesting the output under the
    // same prefix lines the two up: dist/projects/split-calculator/{index.html,
    // assets/...} matches the URLs above, so Vercel serves each asset off disk.
    outDir: `dist${BASE_PATH}`,
    emptyOutDir: true,
  },
  plugins: [
    // Must come before the React plugin - it generates routeTree.gen.ts from
    // the files in src/routes before React refresh transforms them.
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
