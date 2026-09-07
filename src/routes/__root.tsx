import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { Footer } from "@/components/Footer";
import { Sidebar } from "@/components/Sidebar";

// Replaces Next's root layout. The page's <title>, meta, icons and manifest
// now live in index.html - they never varied per route, so there's nothing
// left for a router-level head to manage (and nothing to blank out mid
// navigation, which is what TitleStabilizer used to repair).
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Outlet />
        <Footer />
      </div>
    </div>
  );
}
