import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useConvexAuth, useMutation } from "convex/react";
import {
  BedDouble,
  CalendarDays,
  Bus,
  Car,
  Footprints,
  Hotel,
  House,
  Route as RouteIcon,
  Ship,
  TrainFront,
  Cookie,
  Egg,
  IceCreamCone,
  Map as MapIcon,
  Mountain,
  Sandwich,
  Store,
  Building2,
  GalleryHorizontal,
  type LucideIcon,
  Compass,
  Landmark,
  ShoppingBag,
  Utensils,
  MapPin,
  Pencil,
  Plane,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import { ItineraryTravelSummary, TravelEntryDetails } from "@/components/ItineraryTravelSummary";
import { ItineraryTimeRail } from "@/components/ItineraryTimeRail";
import { EntryDialog, TripDialog } from "@/components/ItineraryDialogs";
import { Breadcrumb, BreadcrumbCurrent, crumbLinkClass } from "@/components/ui/Breadcrumb";
import { Button, buttonVariants } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { OverflowAction, OverflowMenu } from "@/components/ui/OverflowMenu";
import { EmptyState, Page, Panel } from "@/components/ui/Page";
import { GroupTitle, PageDescription, PageTitle, SectionTitle } from "@/components/ui/Typography";
import { isValidISODate, todayISODate } from "@/lib/format";
import type { EntryFields } from "@/lib/itinerary";
import { entryKinds, subtypeLabel } from "@/lib/itineraryCategories";
import { useLocaleFormatters } from "@/lib/localeFormatters";
import { cn } from "@/lib/utils";

type Entry = EntryFields & { id: string };
const entryIcons = {
  event: CalendarDays,
  travel: RouteIcon,
  lodging: BedDouble,
  food: Utensils,
  activity: Compass,
  attraction: Landmark,
  shop: ShoppingBag,
};

const entryIconColors = {
  event: "text-ink-soft",
  travel: "text-sky-800",
  lodging: "text-violet-800",
  food: "text-orange-800",
  activity: "text-teal-800",
  attraction: "text-forest",
  shop: "text-fuchsia-800",
};

const subtypeIcons: Partial<Record<string, LucideIcon>> = {
  flight: Plane,
  bus: Bus,
  train: TrainFront,
  ferry: Ship,
  car: Car,
  walk: Footprints,
  hotel: Hotel,
  bnb: House,
  hostel: BedDouble,
  breakfast: Egg,
  lunch: Sandwich,
  dinner: Utensils,
  snack: Cookie,
  dessert: IceCreamCone,
  museum: GalleryHorizontal,
  tour: MapIcon,
  viewpoint: Mountain,
  landmark: Landmark,
  mall: Building2,
  standalone: Store,
};

function ItineraryDays({
  startDate,
  endDate,
  selectedDate,
  locale,
  id,
}: {
  startDate: string;
  endDate: string;
  selectedDate: string;
  locale: string;
  id: string;
}) {
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const viewport = row.current;
    const link = viewport?.querySelector(`[data-day="${selectedDate}"]`);
    if (!viewport || !link) return;
    const frame = viewport.getBoundingClientRect();
    const bounds = link.getBoundingClientRect();
    if (bounds.left < frame.left || bounds.right > frame.right) {
      viewport.scrollLeft += bounds.left - frame.left - (frame.width - bounds.width) / 2;
    }
  }, [selectedDate]);

  const formatDay = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const days = [];
  const day = new Date(`${startDate}T00:00:00Z`);
  const lastDay = new Date(`${endDate}T00:00:00Z`);
  for (let number = 1; day <= lastDay; number++) {
    days.push({ number, date: day.toISOString().slice(0, 10), label: formatDay.format(day) });
    day.setUTCDate(day.getUTCDate() + 1);
  }

  return (
    <nav aria-label="Itinerary days" className="min-w-0">
      <div ref={row} className="flex gap-2 overflow-x-auto p-2">
        {days.map(({ number, date, label }) => (
          <Link
            key={date}
            data-day={date}
            to="/itineraries/$id"
            params={{ id }}
            search={{ day: date }}
            resetScroll={false}
            aria-current={date === selectedDate ? "page" : undefined}
            className={cn(
              buttonVariants({
                variant: date === selectedDate ? "default" : "secondary",
                size: "touch",
                className: "h-auto min-h-11 min-w-20 flex-col gap-0.5 px-3 py-2",
              }),
            )}
          >
            <span>Day {number}</span>
            <time dateTime={date} className="text-xs">
              {label}
            </time>
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function ItineraryPage({ id, day }: { id: string; day?: string }) {
  const auth = useConvexAuth();
  const {
    data: trip,
    isError,
    refetch,
  } = useQuery(convexQuery(api.itineraries.get, auth.isAuthenticated ? { id } : "skip"));
  const update = useMutation(api.itineraries.update);
  const saveEntry = useMutation(api.itineraries.saveEntry);
  const removeEntry = useMutation(api.itineraries.removeEntry);
  const { locale, formatExpenseDate } = useLocaleFormatters();
  const navigate = useNavigate();
  const [editingTrip, setEditingTrip] = useState(false);
  const [editor, setEditor] = useState<{ entry?: Entry }>();
  const [deleting, setDeleting] = useState<Entry>();

  let date: string | undefined;
  if (trip) {
    const validDay = day && isValidISODate(day) && day >= trip.startDate && day <= trip.endDate;
    date = validDay ? day : trip.startDate < todayISODate() ? trip.endDate : trip.startDate;
  }
  const entries = trip?.entries
    .filter((entry) => entry.date === date)
    .sort((a, b) => (a.time || "24:00").localeCompare(b.time || "24:00"));

  return (
    <Page className="gap-6">
      <Breadcrumb className="mb-0">
        <Link to="/itineraries" className={crumbLinkClass}>
          Itineraries
        </Link>
        <BreadcrumbCurrent>{trip?.title ?? "Itinerary"}</BreadcrumbCurrent>
      </Breadcrumb>
      {auth.isLoading ? (
        <EmptyState>Loading itinerary…</EmptyState>
      ) : !auth.isAuthenticated ? (
        <EmptyState>Sign in to view your itinerary.</EmptyState>
      ) : isError ? (
        <EmptyState status={false}>
          <p role="alert">Couldn’t load this itinerary.</p>
          <Button className="mt-4" variant="secondary" size="touch" onClick={() => void refetch()}>
            Retry
          </Button>
        </EmptyState>
      ) : trip === undefined ? (
        <EmptyState>Loading itinerary…</EmptyState>
      ) : !trip || !date ? (
        <EmptyState>Itinerary unavailable.</EmptyState>
      ) : (
        <>
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <PageTitle>{trip.title}</PageTitle>
              <PageDescription>
                {formatExpenseDate(trip.startDate)} – {formatExpenseDate(trip.endDate)}
              </PageDescription>
            </div>
            <Button variant="secondary" size="touch" onClick={() => setEditingTrip(true)}>
              <Pencil aria-hidden="true" /> Edit itinerary
            </Button>
          </header>

          <ItineraryTravelSummary id={id} entries={trip.entries} />

          <Panel className="flex flex-col gap-5 p-5 sm:p-6">
            <ItineraryDays
              startDate={trip.startDate}
              endDate={trip.endDate}
              selectedDate={date}
              locale={locale}
              id={id}
            />
            <section aria-labelledby="timeline-heading" className="border-t border-rule pt-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <SectionTitle id="timeline-heading" aria-live="polite">
                  {new Intl.DateTimeFormat(locale, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    timeZone: "UTC",
                  }).format(new Date(`${date}T00:00:00Z`))}
                </SectionTitle>
                <Button size="touch" onClick={() => setEditor({})}>
                  <Plus aria-hidden="true" /> Add entry
                </Button>
              </div>
              {entries?.length ? (
                <ItineraryTimeRail date={date}>
                  {entries.map((entry) => (
                    <TimelineEntry
                      key={entry.id}
                      entry={entry}
                      onEdit={() => setEditor({ entry })}
                      onDelete={() => setDeleting(entry)}
                    />
                  ))}
                </ItineraryTimeRail>
              ) : (
                <EmptyState>No entries for this date.</EmptyState>
              )}
            </section>
          </Panel>

          {editingTrip && (
            <TripDialog
              trip={trip}
              onClose={() => setEditingTrip(false)}
              onSave={async (fields) => {
                await update({ id: trip._id, ...fields });
              }}
            />
          )}
          {editor && (
            <EntryDialog
              entry={editor.entry}
              date={date}
              startDate={trip.startDate}
              endDate={trip.endDate}
              onClose={() => setEditor(undefined)}
              onSave={async (entry) => {
                await saveEntry({ id: trip._id, entryId: editor.entry?.id, entry });
                if (entry.date !== date) {
                  await navigate({
                    to: "/itineraries/$id",
                    params: { id },
                    search: { day: entry.date },
                    resetScroll: false,
                  });
                }
              }}
            />
          )}
          <ConfirmDialog
            open={Boolean(deleting)}
            onOpenChange={(open) => {
              if (!open) setDeleting(undefined);
            }}
            title="Remove entry?"
            description={deleting?.title}
            confirmLabel="Remove entry"
            pendingLabel="Removing…"
            onConfirm={async () => {
              if (deleting) await removeEntry({ id: trip._id, entryId: deleting.id });
            }}
          />
        </>
      )}
    </Page>
  );
}

function TimelineEntry({
  entry,
  onEdit,
  onDelete,
}: {
  entry: Entry;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const Icon = (entry.subtype && subtypeIcons[entry.subtype]) || entryIcons[entry.kind];
  const showCategory = entry.kind !== "lodging";
  return (
    <li data-time={entry.time || undefined} className="pb-4 last:pb-0">
      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-2 rounded-lg border border-rule bg-field p-3 sm:gap-x-3">
        <span
          className={cn(
            "flex size-11 items-center justify-center rounded-full border border-rule",
            entry.subtype ? "bg-current/10" : "bg-paper",
            entryIconColors[entry.kind],
          )}
        >
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 self-center">
          <p className="mb-1 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
            {entry.time ? (
              <time
                dateTime={`${entry.date}T${entry.time}`}
                className="font-numeric text-sm font-semibold text-forest"
              >
                {entry.time}
              </time>
            ) : (
              <span>Any time</span>
            )}
            {!showCategory && (
              <>
                <span aria-hidden="true">·</span>
                <span>{entryKinds[entry.kind]}</span>
              </>
            )}
          </p>
          <GroupTitle className="break-words">{entry.title}</GroupTitle>
        </div>
        <OverflowMenu className="sm:hidden" label={`Actions for ${entry.title}`}>
          <OverflowAction onClick={onEdit}>
            <Pencil aria-hidden="true" /> Edit
          </OverflowAction>
          <OverflowAction destructive onClick={onDelete}>
            <Trash2 aria-hidden="true" /> Remove
          </OverflowAction>
        </OverflowMenu>
        <div className="hidden shrink-0 items-start sm:flex">
          <Button
            variant="quiet-icon"
            size="icon-touch"
            aria-label={`Edit ${entry.title}`}
            onClick={onEdit}
          >
            <Pencil aria-hidden="true" />
          </Button>
          <Button
            variant="destructive-icon"
            size="icon-touch"
            aria-label={`Remove ${entry.title}`}
            onClick={onDelete}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
        {entry.kind === "travel" && entry.subtype === "flight" && entry.flight && (
          <div className="col-span-full mt-3 border-t border-rule pt-3">
            <GroupTitle as="h4">Flight details</GroupTitle>
            <div className="mt-2">
              <TravelEntryDetails entry={entry} />
            </div>
          </div>
        )}
        {(showCategory || entry.subtype || entry.location || entry.lodging) && (
          <div className="col-span-full mt-3 flex flex-col gap-2 border-t border-rule pt-3">
            {entry.kind === "lodging" && <GroupTitle as="h4">Lodging details</GroupTitle>}
            {(showCategory || entry.subtype) && (
              <p className="text-sm text-ink">
                <span className="font-medium">{entryKinds[entry.kind]}</span>
                {entry.subtype && (
                  <span className="text-ink-soft"> · {subtypeLabel(entry.subtype)}</span>
                )}
              </p>
            )}
            {entry.location && (
              <div className="flex items-start gap-2 text-sm text-ink">
                <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-forest" />
                {entry.location.url ? (
                  <a
                    href={entry.location.url}
                    className={cn(crumbLinkClass, "text-forest underline underline-offset-4")}
                  >
                    {entry.location.name}
                  </a>
                ) : (
                  <span className="min-w-0 break-words">{entry.location.name}</span>
                )}
              </div>
            )}
            {entry.lodging && <TravelEntryDetails entry={entry} />}
            {entry.kind !== "lodging" && entry.details && (
              <p className="whitespace-pre-wrap break-words text-sm text-ink">{entry.details}</p>
            )}
          </div>
        )}
        {entry.details && entry.kind === "lodging" && (
          <p className="col-span-full mt-3 whitespace-pre-wrap break-words border-t border-rule pt-3 text-sm text-ink">
            {entry.details}
          </p>
        )}
      </div>
    </li>
  );
}
