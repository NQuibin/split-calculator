import { BedDouble, Route as RouteIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Panel } from "@/components/ui/Page";
import { Disclosure } from "@/components/ui/Disclosure";
import { crumbLinkClass } from "@/components/ui/Breadcrumb";
import { GroupTitle } from "@/components/ui/Typography";
import { subtypeLabel } from "@/lib/itineraryCategories";
import type { EntryFields } from "@/lib/itinerary";
import { cn } from "@/lib/utils";
import { useLocaleFormatters } from "@/lib/localeFormatters";

type TravelEntry = EntryFields & { id: string };

function Detail({
  label,
  date,
  time,
  value,
  compact,
}: {
  label: string;
  date?: string;
  time?: string;
  value?: string;
  compact?: boolean;
}) {
  const { formatExpenseDate, formatExpenseDateShort } = useLocaleFormatters();
  if (!date && !time && !value) return null;
  return (
    <div className="min-w-0">
      <dt className={cn("text-ink-soft", compact && "text-xs")}>{label}</dt>
      <dd className={cn("flex flex-wrap gap-x-2 break-words text-ink", compact && "font-semibold")}>
        {date && (
          <time dateTime={date}>
            {compact ? formatExpenseDateShort(date) : formatExpenseDate(date)}
          </time>
        )}
        {time && (
          <time dateTime={time} className="font-numeric">
            {time}
          </time>
        )}
        {value && <span className="font-numeric">{value}</span>}
      </dd>
    </div>
  );
}

function AirportDetail({
  label,
  city,
  code,
  compact,
}: {
  label: string;
  city?: string;
  code?: string;
  compact: boolean;
}) {
  if (!city && !code) return null;
  return (
    <div className="min-w-0">
      <dt className={cn("text-ink-soft", compact && "text-xs")}>{label}</dt>
      <dd className={cn("break-words text-ink", compact && "font-semibold")}>
        {city}
        {city && code && " "}
        {code && <span className="font-numeric">{city ? `(${code})` : code}</span>}
      </dd>
    </div>
  );
}

export function TravelEntryDetails({
  entry,
  compact = false,
}: {
  entry: EntryFields;
  compact?: boolean;
}) {
  const { flight, lodging } = entry;
  if (!flight && !lodging) return null;
  return (
    <dl
      className={cn(
        "gap-y-2 text-sm",
        compact ? "grid grid-cols-2 gap-x-3" : "flex flex-wrap gap-x-6",
      )}
    >
      {flight && (
        <>
          <AirportDetail
            label="Departure"
            city={flight.departureCity}
            code={flight.departureAirportCode}
            compact={compact}
          />
          <AirportDetail
            label="Destination"
            city={flight.destinationCity}
            code={flight.destinationAirportCode}
            compact={compact}
          />
          <Detail label="Local departure time" time={flight.departureTime} compact={compact} />
          <Detail label="Local arrival time" time={flight.arrivalTime} compact={compact} />
          <Detail label="Flight number" value={flight.number} compact={compact} />
        </>
      )}
      {lodging && (
        <>
          <Detail
            label="Local check-in"
            date={lodging.checkInDate}
            time={lodging.checkIn}
            compact={compact}
          />
          <Detail
            label="Local check-out"
            date={lodging.checkOutDate}
            time={lodging.checkOut}
            compact={compact}
          />
        </>
      )}
    </dl>
  );
}

export function ItineraryTravelSummary({ id, entries }: { id: string; entries: TravelEntry[] }) {
  const { formatExpenseDateShort } = useLocaleFormatters();
  const travel = entries
    .filter((entry) => entry.kind === "travel" || entry.kind === "lodging")
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || (a.time || "24:00").localeCompare(b.time || "24:00"),
    );
  if (!travel.length) return null;

  return (
    <Panel className="divide-y divide-rule">
      {(
        [
          { kind: "travel", label: "Travel", icon: RouteIcon, empty: "No travel added." },
          { kind: "lodging", label: "Lodging", icon: BedDouble, empty: "No lodging added." },
        ] as const
      ).map(({ kind, label, icon, empty }) => {
        const items = travel.filter((entry) => entry.kind === kind);
        return (
          <Disclosure key={kind} label={label} icon={icon}>
            {items.length ? (
              <ul className="flex flex-col gap-4">
                {items.map((entry) => (
                  <li key={entry.id} className="flex min-w-0 flex-col gap-1.5">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <GroupTitle className="min-w-0 break-words">
                        <Link
                          to="/itineraries/$id"
                          params={{ id }}
                          search={{ day: entry.date }}
                          className={crumbLinkClass}
                        >
                          {entry.title}
                        </Link>
                      </GroupTitle>
                      <time
                        dateTime={entry.date}
                        className="ms-auto text-end text-xs text-ink-soft"
                      >
                        {formatExpenseDateShort(entry.date)}
                      </time>
                    </div>
                    {(entry.subtype ||
                      (entry.kind === "travel" && !entry.flight && entry.time)) && (
                      <p className="flex flex-wrap gap-x-2 text-xs text-ink-soft">
                        {entry.subtype && <span>{subtypeLabel(entry.subtype)}</span>}
                        {entry.kind === "travel" && !entry.flight && entry.time && (
                          <time dateTime={entry.time} className="font-numeric">
                            {entry.time}
                          </time>
                        )}
                      </p>
                    )}
                    <TravelEntryDetails entry={entry} compact />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-soft">{empty}</p>
            )}
          </Disclosure>
        );
      })}
    </Panel>
  );
}
