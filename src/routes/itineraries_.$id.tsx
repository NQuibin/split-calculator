import { createFileRoute } from "@tanstack/react-router";
import { ItineraryPage } from "@/pages/ItineraryPage";

export const Route = createFileRoute("/itineraries_/$id")({
  validateSearch: (search: Record<string, unknown>): { day?: string } => ({
    day: typeof search.day === "string" ? search.day : undefined,
  }),
  component: ItineraryRoute,
});

function ItineraryRoute() {
  const { id } = Route.useParams();
  const { day } = Route.useSearch();
  return <ItineraryPage key={id} id={id} day={day} />;
}
