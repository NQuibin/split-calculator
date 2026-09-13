import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, ReceiptText, Settings, Users, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SidebarAccount } from "@/components/SidebarAccount";

function isActive(pathname: string | null, href: string): boolean {
  return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
}

export function Sidebar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const openButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLElement>(null);

  // Moving focus into the drawer is what makes it usable from a keyboard at
  // all; putting it back on the trigger afterwards is what stops focus from
  // jumping to the top of the document on close.
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const trigger = openButton.current;
    drawer.current?.querySelector<HTMLElement>("a, button")?.focus();
    return () => (previous ?? trigger)?.focus();
  }, [mobileOpen]);

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
      <div className="flex items-center justify-between border-b border-rule bg-surface px-4 py-2 pt-[calc(0.5rem+env(safe-area-inset-top))] md:hidden">
        <BrandLink />
        <Button
          type="button"
          variant="ghost"
          size="icon-touch"
          ref={openButton}
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          aria-controls="app-nav"
          aria-expanded={mobileOpen}
          className="-mr-2 text-ink-soft hover:text-forest"
        >
          <Menu className="h-5 w-5" strokeWidth={2.25} />
        </Button>
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/30 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* `invisible` (not just translated off-screen) is what takes the closed
          drawer's links out of the tab order; it's part of the transition so
          the panel still slides out rather than vanishing, and `md:visible`
          puts it back for the permanent desktop sidebar. */}
      <aside
        id="app-nav"
        ref={drawer}
        onKeyDown={(event) => {
          if (event.key === "Escape") setMobileOpen(false);
        }}
        className={`fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col border-r border-rule/60 bg-surface pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] transition-[transform,visibility] duration-200 ease-in-out md:sticky md:top-0 md:z-auto md:h-screen md:visible md:translate-x-0 md:pt-0 ${
          mobileOpen ? "visible translate-x-0" : "invisible -translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 pt-7 pb-6">
          <BrandLink />
          <Button
            type="button"
            variant="ghost"
            size="icon-touch"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="-mr-2 text-ink-soft md:hidden"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </Button>
        </div>

        <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto px-4 py-2">
          {[
            {
              label: "Tabs",
              href: "/tabs",
              icon: Wallet,
              active: pathname === "/" || isActive(pathname, "/tabs") || isActive(pathname, "/t"),
            },
            {
              label: "Expenses",
              href: "/expenses",
              icon: ReceiptText,
              active: isActive(pathname, "/expenses") || isActive(pathname, "/e"),
            },
            {
              label: "Friends",
              href: "/friends",
              icon: Users,
              active: isActive(pathname, "/friends"),
            },
            {
              label: "Settings",
              href: "/settings",
              icon: Settings,
              active: isActive(pathname, "/settings"),
            },
          ].map(({ label, href, icon: Icon, active }) => (
            <Link
              key={href}
              to={href}
              aria-current={active ? "page" : undefined}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-4 rounded-xl px-4 py-3.5 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${active ? "bg-rule/30 font-semibold text-forest" : "text-ink-soft hover:bg-wash"}`}
            >
              <Icon
                aria-hidden="true"
                className={`h-5 w-5 shrink-0 ${active ? "text-forest" : "text-ink-soft"}`}
                strokeWidth={2}
              />
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
    <Link
      to="/tabs"
      className="-mx-2 inline-flex min-h-11 items-center rounded-md px-2 font-display text-lg font-semibold tracking-tight text-brass-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
    >
      Ventura
    </Link>
  );
}
