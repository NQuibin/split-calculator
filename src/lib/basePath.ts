// Single source of truth for the app's basePath: vite.config.ts feeds it to
// `base` and `outDir`, main.tsx to the router's `basepath`, and anything
// building a plain string URL (invite links) prefixes with it by hand.
export const BASE_PATH = "/projects/split-calculator";
