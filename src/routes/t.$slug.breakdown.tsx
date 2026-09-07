import { createFileRoute } from "@tanstack/react-router";
import { AccessErrorPage } from "@/components/AccessErrorPage";
import { TabBreakdownPage } from "@/pages/TabBreakdownPage";

export const Route = createFileRoute("/t/$slug/breakdown")({
  component: TabBreakdownPage,
  errorComponent: ({ error }) => <AccessErrorPage error={error} resource="tab" />,
});
