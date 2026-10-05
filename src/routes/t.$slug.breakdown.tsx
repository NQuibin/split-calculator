import { createFileRoute } from "@tanstack/react-router";
import { SharedTabPage } from "@/pages/SharedTabPage";

export const Route = createFileRoute("/t/$slug/breakdown")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { share?: string; view?: "breakdown" | "history" } => ({
    share: typeof search.share === "string" ? search.share : undefined,
    view: search.view === "history" ? "history" : "breakdown",
  }),
  component: BreakdownRoute,
});

function BreakdownRoute() {
  const { slug } = Route.useParams();
  const { share, view } = Route.useSearch();
  return <SharedTabPage slug={slug} share={share} view={view ?? "breakdown"} />;
}
