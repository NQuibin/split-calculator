import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { fileURLToPath } from "node:url";
import { BASE_PATH } from "./src/lib/basePath";

export default defineConfig({
  // The app is served under nquibin.dev via a rewrite, so every asset URL and
  // every route has to carry this prefix (it replaces Next's `basePath`).
  base: `${BASE_PATH}/`,
  build: {
    // `base` only rewrites the URLs written into index.html - it does not move
    // the emitted files. Next's `basePath` did both, serving pages at the
    // prefixed path on the deployment itself, which is what the nquibin.dev
    // rewrite forwards to. Nesting the output under the same prefix restores
    // that: dist/projects/split-calculator/{index.html,assets/...} lines up
    // with the URLs above, so Vercel serves each asset straight off disk.
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
