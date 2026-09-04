import { TabBreakdownPageClient } from "./TabBreakdownPageClient";

// A Server Component wrapper, so the root layout's metadata stays stable
// across client-side navigations instead of flickering (metadata/title
// export is only supported in Server Components - see AGENTS.md).
export default function TabBreakdownPage() {
  return <TabBreakdownPageClient />;
}
