import { createFileRoute } from "@tanstack/react-router";
import { SharedTabPage } from "@/pages/SharedTabPage";

export const Route = createFileRoute("/t/$slug/breakdown")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { share?: string; view?: "breakdown" | "history"; member?: string } => ({
    member: typeof search.member === "string" ? search.member : undefined,
    share: typeof search.share === "string" ? search.share : undefined,
    view: search.view === "history" ? "history" : "breakdown",
  }),
  component: BreakdownRoute,
});

function BreakdownRoute() {
  const { slug } = Route.useParams();
  const { share, view, member } = Route.useSearch();
  return <SharedTabPage slug={slug} share={share} member={member} view={view ?? "breakdown"} />;
}
