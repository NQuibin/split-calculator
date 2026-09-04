"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Authenticated, Unauthenticated } from "convex/react";
import { Menu, Receipt as ExpenseIcon, Trash2, Users, Users2, X } from "lucide-react";
import { CreateTabMenu } from "@/components/CreateTabMenu";
import { NewExpenseButton } from "@/components/NewExpenseButton";
import { SidebarAccount } from "@/components/SidebarAccount";
import { currency } from "@/lib/format";
import { expenseLabel } from "@/lib/expenseLabel";
import { computeSplit } from "@/lib/calculations";
import { useExpenseActions, useExpenseList } from "@/lib/expenseSync";
import { useTabList } from "@/lib/tabSync";

function isActive(pathname: string | null, href: string): boolean {
  return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
}

export function Sidebar() {
  const pathname = usePathname();
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
          className="cursor-pointer rounded-md p-1.5 text-ink-soft transition hover:text-forest"
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
        className={`fixed inset-y-0 left-0 z-50 flex w-72 shrink-0 flex-col border-r border-rule bg-surface transition-transform duration-200 ease-in-out md:sticky md:top-0 md:z-auto md:h-screen md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-rule px-5 py-4">
          <BrandLink />
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="cursor-pointer rounded-md p-1.5 text-ink-soft transition hover:text-margin-red md:hidden"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          <NewExpenseButton className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-forest px-4 py-2.5 font-display text-sm font-semibold text-surface transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red" />

          <TabsSection pathname={pathname} />
          <ExpensesSection pathname={pathname} />
        </div>

        <div className="border-t border-rule p-3">
          <SidebarAccount />
        </div>
      </aside>
    </>
  );
}

function BrandLink() {
  return (
    <Link href="/" className="flex items-center gap-2 text-brass">
      <Users className="h-5 w-5" strokeWidth={2.25} />
      <span className="font-display text-sm font-semibold tracking-wide uppercase">Split Calculator</span>
    </Link>
  );
}

function SectionHeader({
  icon: Icon,
  label,
  action,
}: {
  icon: typeof Users2;
  label: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2 px-1">
      <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-ink-soft uppercase">
        <Icon className="h-3.5 w-3.5 text-brass" strokeWidth={2.25} />
        {label}
      </p>
      {action}
    </div>
  );
}

function NavItem({
  href,
  active,
  title,
  subtitle,
  trailing,
  onDelete,
}: {
  href: string;
  active: boolean;
  title: string;
  subtitle: string;
  trailing?: string;
  onDelete?: () => void;
}) {
  return (
    <li
      className={`group flex items-center gap-1 rounded-md transition ${
        active ? "bg-forest text-surface" : "text-ink hover:bg-paper"
      }`}
    >
      <Link
        href={href}
        className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
      >
        <span className="min-w-0">
          <span className="block truncate font-medium">{title}</span>
          <span className={`block truncate text-xs ${active ? "text-surface/70" : "text-ink-soft"}`}>
            {subtitle}
          </span>
        </span>
        {trailing && (
          <span className={`font-numeric shrink-0 text-xs font-semibold ${active ? "text-surface" : "text-ink"}`}>
            {trailing}
          </span>
        )}
      </Link>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete expense"
          className={`shrink-0 cursor-pointer rounded-md p-1.5 opacity-0 transition focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red group-hover:opacity-100 ${
            active ? "text-surface/80 hover:text-surface" : "text-ink-soft hover:text-margin-red"
          }`}
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
        </button>
      )}
    </li>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="px-3 py-1 text-xs text-ink-soft">{children}</p>;
}

function TabsSection({ pathname }: { pathname: string | null }) {
  const tabs = useTabList();

  return (
    <div>
      <SectionHeader icon={Users2} label="Tabs" action={<CreateTabMenu variant="icon" />} />
      <Authenticated>
        {tabs.length === 0 ? (
          <EmptyHint>No tabs yet.</EmptyHint>
        ) : (
          <ul className="space-y-0.5">
            {tabs.map(({ slug, name, memberCount }) => (
              <NavItem
                key={slug}
                href={`/t/${slug}`}
                active={isActive(pathname, `/t/${slug}`)}
                title={name}
                subtitle={`${memberCount} ${memberCount === 1 ? "member" : "members"}`}
              />
            ))}
          </ul>
        )}
      </Authenticated>
      <Unauthenticated>
        <EmptyHint>Sign in to create tabs.</EmptyHint>
      </Unauthenticated>
    </div>
  );
}

function ExpensesSection({ pathname }: { pathname: string | null }) {
  const expenses = useExpenseList();
  const { remove } = useExpenseActions();

  return (
    <div>
      <SectionHeader icon={ExpenseIcon} label="Expenses" />
      {expenses.length === 0 ? (
        <EmptyHint>No expenses yet.</EmptyHint>
      ) : (
        <ul className="space-y-0.5">
          {expenses.map(({ slug, state }) => {
            const total = computeSplit(state.people, state.items).grandTotal;
            const active = isActive(pathname, `/e/${slug}`);
            return (
              <NavItem
                key={slug}
                href={`/e/${slug}`}
                active={active}
                title={expenseLabel(state.name, state.people)}
                subtitle={`${state.items.length} ${state.items.length === 1 ? "item" : "items"}`}
                trailing={currency(total)}
                onDelete={() => remove(slug)}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
