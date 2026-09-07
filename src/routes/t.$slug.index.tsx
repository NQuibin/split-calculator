import { createFileRoute } from "@tanstack/react-router";
import { AccessErrorPage } from "@/components/AccessErrorPage";
import { TabPage } from "@/pages/TabPage";

export const Route = createFileRoute("/t/$slug/")({
  // `token` is an invite token, claimed on arrival for a signed-in visitor.
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: (search.token as string) || undefined,
  }),
  component: TabPage,
  // Convex throws from inside `useQuery`, so a tab the viewer isn't in
  // surfaces here rather than as a render crash.
  errorComponent: ({ error }) => <AccessErrorPage error={error} resource="tab" />,
});
