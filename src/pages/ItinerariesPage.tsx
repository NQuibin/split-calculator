import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useConvexAuth, useMutation } from "convex/react";
import { CalendarDays, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { TripDialog } from "@/components/ItineraryDialogs";
import { Button, buttonVariants } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/Input";
import { EmptyState, Page, Panel } from "@/components/ui/Page";
import { PageDescription, PageTitle, SectionTitle } from "@/components/ui/Typography";
import { itineraryError } from "@/lib/itinerary";
import { useLocaleFormatters } from "@/lib/localeFormatters";

export function ItinerariesPage() {
  const auth = useConvexAuth();
  const {
    data: trips,
    isError,
    refetch,
  } = useQuery(convexQuery(api.itineraries.list, auth.isAuthenticated ? {} : "skip"));
  const create = useMutation(api.itineraries.create);
  const importTrip = useMutation(api.itineraries.importCostaRica);
  const navigate = useNavigate();
  const { formatExpenseDate } = useLocaleFormatters();
  const [editing, setEditing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");

  async function addCostaRica() {
    setImportError("");
    setImporting(true);
    try {
      const id = await importTrip({});
      await navigate({ to: "/itineraries/$id", params: { id } });
    } catch (error) {
      setImportError(itineraryError(error, "Couldn’t add Costa Rica. Try again."));
    } finally {
      setImporting(false);
    }
  }

  return (
    <Page className="gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <PageTitle>Itineraries</PageTitle>
          <PageDescription>Plan flights, lodging, and what to do each day.</PageDescription>
        </div>
        {auth.isAuthenticated && (
          <Button size="touch" onClick={() => setEditing(true)}>
            <Plus aria-hidden="true" /> New itinerary
          </Button>
        )}
      </header>
      {auth.isLoading ? (
        <EmptyState>Loading itineraries…</EmptyState>
      ) : !auth.isAuthenticated ? (
        <EmptyState>Sign in to create and view your itineraries.</EmptyState>
      ) : isError ? (
        <EmptyState status={false}>
          <p role="alert">Couldn’t load your itineraries.</p>
          <Button className="mt-4" variant="secondary" size="touch" onClick={() => void refetch()}>
            Retry
          </Button>
        </EmptyState>
      ) : !trips ? (
        <EmptyState>Loading itineraries…</EmptyState>
      ) : (
        <>
          {trips.length > 0 && (
            <Panel>
              <ul className="divide-y divide-rule">
                {trips.map((trip) => (
                  <li key={trip._id}>
                    <Link
                      to="/itineraries/$id"
                      params={{ id: trip._id }}
                      className={buttonVariants({
                        variant: "row",
                        size: "row",
                        className: "group",
                      })}
                    >
                      <CalendarDays
                        aria-hidden="true"
                        className="size-5 justify-self-center text-forest"
                      />
                      <div className="min-w-0">
                        <SectionTitle>{trip.title}</SectionTitle>
                        <p className="mt-1 text-sm text-ink-soft">
                          {formatExpenseDate(trip.startDate)} – {formatExpenseDate(trip.endDate)}
                        </p>
                      </div>
                      <ChevronRight aria-hidden="true" className="size-4 chevron-x" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {!trips.some((trip) => trip.isCostaRica) && (
            <Panel className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <SectionTitle>Costa Rica</SectionTitle>
                <p className="mt-1 text-sm text-ink-soft">November 17–24, 2026</p>
              </div>
              <Button
                variant="secondary"
                size="touch"
                disabled={importing}
                aria-busy={importing}
                onClick={addCostaRica}
              >
                {importing ? "Adding…" : "Add Costa Rica itinerary"}
              </Button>
              {importError && <FieldError className="w-full">{importError}</FieldError>}
            </Panel>
          )}
        </>
      )}
      {auth.isAuthenticated && editing && (
        <TripDialog
          onClose={() => setEditing(false)}
          onSave={async (fields) => {
            const id = await create(fields);
            await navigate({ to: "/itineraries/$id", params: { id } });
          }}
        />
      )}
    </Page>
  );
}
