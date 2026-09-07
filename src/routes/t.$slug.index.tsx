import { createFileRoute } from "@tanstack/react-router";
import { TabPage } from "@/pages/TabPage";

export const Route = createFileRoute("/t/$slug/")({
  // `token` is an invite token, claimed on arrival for a signed-in visitor.
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: (search.token as string) || undefined,
  }),
  component: TabPage,
});
