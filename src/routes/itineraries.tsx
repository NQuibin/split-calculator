import { createFileRoute } from "@tanstack/react-router";
import { ItinerariesPage } from "@/pages/ItinerariesPage";

export const Route = createFileRoute("/itineraries")({ component: ItinerariesPage });
