import { createFileRoute } from "@tanstack/react-router";
import { AccessErrorPage } from "@/components/AccessErrorPage";
import { ExpensePage } from "@/pages/ExpensePage";

export interface ExpenseSearch {
  count?: string;
  names?: string;
  ids?: string;
  tab?: string;
}

export const Route = createFileRoute("/e/$slug")({
  // count/names/ids seed a brand-new expense from the "New expense" button
  // (see expenseDraft.ts); `tab` destines it for a tab.
  validateSearch: (search: Record<string, unknown>): ExpenseSearch => ({
    count: (search.count as string) || undefined,
    names: (search.names as string) || undefined,
    ids: (search.ids as string) || undefined,
    tab: (search.tab as string) || undefined,
  }),
  component: ExpensePage,
  // Convex throws from inside `useQuery`, so an expense that isn't the
  // viewer's to open surfaces here rather than as a render crash.
  errorComponent: ({ error }) => <AccessErrorPage error={error} resource="expense" />,
});
