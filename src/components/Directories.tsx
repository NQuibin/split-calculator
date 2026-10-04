import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import type { FunctionReturnType } from "convex/server";
import { ChevronRight, Plus, X } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { MemberAvatar } from "@/components/MemberAvatar";
import { CreateTabMenu } from "@/components/CreateTabMenu";
import { todayISODate } from "@/lib/format";
import { useLocaleFormatters } from "@/lib/localeFormatters";
import { PageDescription, PageTitle, SectionTitle } from "@/components/ui/Typography";
import { EmptyState, Page } from "@/components/ui/Page";
import { Skeleton } from "@/components/ui/Skeleton";
import { mobileRaisedSurfaceClass } from "@/components/ui/mobileRaisedSurface";
import { Button } from "@/components/ui/Button";
import { AnonymousBadge } from "@/components/ui/AnonymousBadge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";

function Directory({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Page>
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <PageTitle>{title}</PageTitle>
          <PageDescription>{description}</PageDescription>
        </div>
        {action}
      </header>
      {children}
    </Page>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return <EmptyState>{children}</EmptyState>;
}

function TabsListSkeleton() {
  return (
    <div role="status" className="flex flex-1 flex-col">
      <span className="sr-only">Loading tabs…</span>
      <ul
        aria-hidden="true"
        className="flex flex-1 flex-col gap-4 sm:gap-0 sm:divide-y sm:divide-rule/70 sm:overflow-hidden sm:rounded-xl sm:border sm:border-rule/70"
      >
        {["first", "second", "third"].map((row) => (
          <li
            key={row}
            className="flex min-h-56 flex-1 flex-col gap-6 rounded-xl border border-rule/70 bg-surface px-5 py-6 last:hidden sm:min-h-40 sm:flex-row sm:rounded-none sm:border-0 sm:px-6 sm:py-8 sm:last:flex"
          >
            <div className="flex-1 space-y-4">
              <Skeleton className="h-5 w-40 rounded-md" />
              <Skeleton className="h-3 w-32 rounded-md" />
              <div className="flex gap-1.5">
                {["a", "b", "c", "d", "e"].map((avatar) => (
                  <Skeleton key={avatar} className="size-8 rounded-full" />
                ))}
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-5 border-t border-rule pt-5 sm:border-0 sm:pt-0">
              {["first", "second"].map((currency) => (
                <div key={currency} className="flex flex-1 flex-col gap-4 sm:flex-row sm:gap-6">
                  <Skeleton className="h-6 w-14 shrink-0 rounded-full" />
                  <div className="grid flex-1 grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-20 max-w-full rounded-md" />
                      <Skeleton className="h-4 w-24 max-w-full rounded-md" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-16 max-w-full rounded-md" />
                      <Skeleton className="h-4 w-24 max-w-full rounded-md" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const directoryListClass = `${mobileRaisedSurfaceClass} divide-y divide-rule/70 overflow-hidden border border-rule/70 bg-surface`;
const tabRowClass =
  "group relative block rounded-xl border border-rule/70 bg-surface px-5 py-6 transition-colors hover:bg-wash active:bg-wash focus-visible:bg-wash focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_auto] sm:items-center sm:gap-6 sm:rounded-none sm:border-0 sm:px-6 sm:py-8";

type TabRow = FunctionReturnType<typeof api.tabs.listWithSummary>[number];

export function TabsDirectory() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [day, setDay] = useState(todayISODate);
  const { data: tabs } = useQuery(
    convexQuery(api.tabs.listWithSummary, isAuthenticated ? { asOfDate: day } : "skip"),
  );
  useEffect(() => {
    const refresh = () => setDay(todayISODate());
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const loading = isLoading || (isAuthenticated && tabs === undefined);
  return (
    <Directory
      title="Tabs"
      description="Your tabs, all in one place."
      action={
        !loading && isAuthenticated && tabs?.length ? (
          <CreateTabMenu variant="primary" />
        ) : undefined
      }
    >
      {loading ? (
        <TabsListSkeleton />
      ) : !isAuthenticated ? (
        <Notice>Sign in to create a tab or see the tabs you belong to.</Notice>
      ) : !tabs?.length ? (
        <EmptyState className="flex flex-col items-center gap-4">
          <span
            aria-hidden="true"
            className="flex size-12 items-center justify-center rounded-lg border-2 border-forest text-forest"
          >
            <Plus className="size-6" />
          </span>
          <div>
            <SectionTitle>No tabs yet</SectionTitle>
            <p className="mt-2">Create a tab to start sharing expenses and tracking balances.</p>
          </div>
          <CreateTabMenu />
        </EmptyState>
      ) : (
        <ul className="space-y-4 sm:space-y-0 sm:divide-y sm:divide-rule/70 sm:overflow-hidden sm:rounded-xl sm:border sm:border-rule/70">
          {tabs.map((tab) => (
            <TabDirectoryRow key={tab.slug} tab={tab} />
          ))}
        </ul>
      )}
    </Directory>
  );
}

// Purely presentational - every field arrives with the tab from
// `listWithSummary`, so a row never loads anything of its own.
function TabDirectoryRow({ tab }: { tab: TabRow }) {
  const { currency } = useLocaleFormatters();
  const totals = new Map(tab.totals.map(({ currency: code, total }) => [code, total]));
  const codes = [
    ...new Set([...totals.keys(), ...tab.balances.map(({ currency }) => currency)]),
  ].sort((a, b) => a.localeCompare(b));
  if (!codes.length) codes.push(tab.defaultCurrency);
  return (
    <li>
      <Link to="/t/$slug" params={{ slug: tab.slug }} className={tabRowClass}>
        <div className="min-w-0 pr-8 sm:self-start sm:pr-0">
          <SectionTitle>{tab.name}</SectionTitle>
          <p className="mt-2 text-xs text-ink-soft">
            <span className="font-numeric">{tab.expenseCount}</span>{" "}
            {tab.expenseCount === 1 ? "expense" : "expenses"} ·{" "}
            <span className="font-numeric">{tab.memberCount}</span>{" "}
            {tab.memberCount === 1 ? "member" : "members"}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {/* The whole row is one link, so the avatars are hidden rather than
                labelled - the count beside them already names the group, and
                each avatar's name would otherwise pad the link's name. */}
            <span aria-hidden="true" className="flex flex-wrap items-center gap-1.5">
              {tab.members.slice(0, 5).map((member) => (
                <MemberAvatar key={member.id} id={member.id} name={member.name} />
              ))}
              {tab.memberCount > 5 && (
                <span className="flex size-8 items-center justify-center rounded-full bg-chip-neutral font-numeric text-xs font-semibold text-ink">
                  +{tab.memberCount - 5}
                </span>
              )}
            </span>
          </div>
        </div>
        <div className="mt-5 min-w-0 divide-y divide-rule sm:mt-0 sm:flex sm:flex-col sm:gap-6 sm:divide-y-0">
          {codes.map((code) => {
            const balance = tab.balances.find((item) => item.currency === code);
            const owed = balance?.owed ?? 0;
            const owe = balance?.owe ?? 0;
            return (
              <div
                key={code}
                className="py-5 first:border-t first:border-rule sm:py-0 sm:first:border-t-0 sm:grid sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-6"
              >
                <span className="inline-flex h-fit w-fit justify-self-start rounded-full border border-rule bg-chip-neutral px-3 py-1 font-numeric text-xs font-semibold text-ink">
                  {code}
                </span>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-0 sm:gap-6">
                  {owed > 0 || owe > 0 ? (
                    <div className="min-w-0 space-y-3">
                      {owed > 0 && (
                        <div>
                          <span className="block text-sm text-ink-soft">You are owed</span>
                          <span className="mt-1 block font-numeric text-sm font-semibold text-ledger-green">
                            {currency(owed, code)}
                          </span>
                        </div>
                      )}
                      {owe > 0 && (
                        <div>
                          <span className="block text-sm text-ink-soft">You owe</span>
                          <span className="mt-1 block font-numeric text-sm font-semibold text-margin-red-ink">
                            {currency(owe, code)}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-ink-soft">No balance</span>
                  )}
                  <div className="min-w-0">
                    <span className="block text-sm text-ink-soft">Tab total</span>
                    <span className="mt-2 block font-numeric text-sm font-semibold text-ink">
                      {currency(totals.get(code) ?? 0, code)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <ChevronRight
          aria-hidden="true"
          className="absolute right-5 top-6 h-5 w-5 text-ink-soft chevron-x sm:static"
        />
      </Link>
    </li>
  );
}

/**
 * One friend. The shared tabs used to sit inline as chips, which disappeared
 * against the card and wrapped badly once someone shared more than two or
 * three. They live behind a dialog now: the row states the count, the dialog
 * lists them — the same shape as the tab page's member roster.
 */
function FriendRow({
  id,
  name,
  claimed,
  tabs,
}: {
  id: string;
  name: string;
  claimed: boolean;
  tabs: { slug: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const count = `${tabs.length} shared ${tabs.length === 1 ? "tab" : "tabs"}`;
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-5 sm:flex-nowrap sm:px-6">
      <MemberAvatar id={id} name={name} className={claimed ? "" : "opacity-60"} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <SectionTitle>{name}</SectionTitle>
          {!claimed && <AnonymousBadge />}
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button
              type="button"
              variant="secondary"
              size="touch"
              aria-label={`View the ${count} with ${name}`}
              className="w-full justify-between sm:w-auto sm:justify-center"
            />
          }
        >
          {count}
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle>{name}</DialogTitle>
              <DialogDescription className="mt-1">Tabs you both belong to</DialogDescription>
            </div>
            <DialogClose
              aria-label="Close"
              render={<Button variant="ghost" size="icon-touch" className="text-ink-soft" />}
            >
              <X className="h-4 w-4" />
            </DialogClose>
          </div>
          <ul className="mt-4 overflow-hidden rounded-lg border border-edge bg-field">
            {tabs.map((tab) => (
              <li key={tab.slug} className="border-b border-rule/70 last:border-b-0">
                <Link
                  to="/t/$slug"
                  params={{ slug: tab.slug }}
                  onClick={() => setOpen(false)}
                  className="group flex min-h-11 items-center justify-between gap-3 px-4 py-3 text-sm text-ink transition hover:bg-wash active:bg-wash focus-visible:bg-wash focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest"
                >
                  <span className="min-w-0 break-words font-medium">{tab.name}</span>
                  <ChevronRight
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-ink-soft chevron-x"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </li>
  );
}

export function FriendsDirectory() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { data: people } = useQuery(convexQuery(api.tabs.friends, isAuthenticated ? {} : "skip"));
  const loading = isLoading || (isAuthenticated && people === undefined);
  return (
    <Directory
      title="Friends"
      description="The people you share tabs with. Anonymous friends haven’t claimed an invite yet."
    >
      {loading ? (
        <Notice>Loading friends…</Notice>
      ) : !isAuthenticated ? (
        <Notice>Sign in to see your friends across tabs.</Notice>
      ) : !people?.length ? (
        <Notice>Friends will appear here when you create or join a tab.</Notice>
      ) : (
        <ul className={directoryListClass}>
          {people.map(({ id, ...person }) => (
            <FriendRow
              key={id}
              id={id}
              name={person.name}
              claimed={person.claimed}
              tabs={person.tabs}
            />
          ))}
        </ul>
      )}
    </Directory>
  );
}
