import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig, globalIgnores } from "eslint/config";

// Biome owns formatting and general JS/TS/a11y linting (see biome.json). ESLint
// is kept solely for eslint-plugin-react-hooks, whose React Compiler rules
// (set-state-in-effect, purity, preserve-manual-memoization, ...) have no
// Biome equivalent.
export default defineConfig([
  globalIgnores(["dist/**", "convex/_generated/**", "src/routeTree.gen.ts"]),
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    // The parser is all that is taken from typescript-eslint - none of its
    // rules run, since Biome covers that ground.
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: { ...reactHooks.configs.recommended.rules },
  },
]);
