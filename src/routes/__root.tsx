import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { Footer } from "@/components/Footer";
import { Sidebar } from "@/components/Sidebar";

// The page's <title>, meta, icons and manifest live in index.html: none of
// them vary per route, so there's nothing for a router-level head to manage.
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="flex min-h-full flex-col md:flex-row">
      {/* First thing in the tab order, visible only once focused: lets a
          keyboard user skip the nav on every route. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[60] focus:rounded-md focus:bg-forest focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-surface"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Outlet />
        <Footer />
      </div>
    </div>
  );
}
