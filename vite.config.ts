import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { fileURLToPath } from "node:url";
import { BASE_PATH } from "./src/lib/basePath";

export default defineConfig({
  // Ventura is served from venturago.app's root.
  base: `${BASE_PATH}/`,
  build: {
    // `base` only rewrites URLs written into index.html. Root hosting keeps
    // emitted files directly under dist/.
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
