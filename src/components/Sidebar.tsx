import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, ReceiptText, Settings, Users, Wallet, X } from "lucide-react";
import { SidebarAccount } from "@/components/SidebarAccount";

function isActive(pathname: string | null, href: string): boolean {
  return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
}

export function Sidebar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile drawer whenever the route changes, without an Effect
  // (React's recommended pattern for resetting state on a prop change).
  const [openedForPathname, setOpenedForPathname] = useState(pathname);
  if (pathname !== openedForPathname) {
    setOpenedForPathname(pathname);
    setMobileOpen(false);
  }

  // A publicly shared expense link has no owner chrome to show.
  const bare = pathname === "/s" || pathname?.startsWith("/s/");

  if (bare) return null;

  return (
    <>
      <div className="flex items-center justify-between border-b border-rule bg-surface px-4 py-3 md:hidden">
        <BrandLink />
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="rounded-md p-1.5 text-ink-soft transition hover:text-forest"
        >
          <Menu className="h-5 w-5" strokeWidth={2.25} />
        </button>
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/30 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col border-r border-rule/60 bg-surface transition-transform duration-200 ease-in-out md:sticky md:top-0 md:z-auto md:h-screen md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 pt-7 pb-6">
          <BrandLink />
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="rounded-md p-1.5 text-ink-soft transition hover:text-margin-red md:hidden"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>

        <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto px-4 py-2">
          {[
            { label: "Tabs", href: "/tabs", icon: Wallet, active: pathname === "/" || isActive(pathname, "/tabs") || isActive(pathname, "/t") },
            { label: "Expenses", href: "/expenses", icon: ReceiptText, active: isActive(pathname, "/expenses") || isActive(pathname, "/e") },
            { label: "Friends", href: "/friends", icon: Users, active: isActive(pathname, "/friends") || isActive(pathname, "/people") },
            { label: "Settings", href: "/settings", icon: Settings, active: isActive(pathname, "/settings") },
          ].map(({ label, href, icon: Icon, active }) => (
            <Link key={href} to={href} aria-current={active ? "page" : undefined}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-4 rounded-xl px-4 py-3.5 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${active ? "bg-rule/30 font-semibold text-forest" : "text-ink-soft hover:bg-rule/20"}`}>
              <Icon aria-hidden="true" className={`h-5 w-5 shrink-0 ${active ? "text-brass" : "text-ink-soft"}`} strokeWidth={2} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-rule p-3">
          <SidebarAccount />
        </div>
      </aside>
    </>
  );
}

function BrandLink() {
  return (
    <Link to="/tabs" className="font-display text-lg font-semibold tracking-tight text-brass">
      SumShare
    </Link>
  );
}
