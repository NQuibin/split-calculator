// Single source of truth for the app's basePath (next.config.ts) - metadata
// files (manifest, layout icons) can't rely on Next's automatic basePath
// prefixing since they return plain string URLs, so they import this instead.
export const BASE_PATH = "/projects/split-calculator";
