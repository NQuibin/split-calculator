import { Link } from "@tanstack/react-router";
import { Disclosure } from "@/components/ui/Disclosure";
import { crumbLinkClass } from "@/components/ui/Breadcrumb";
import { GroupTitle, SectionTitle } from "@/components/ui/Typography";
import type { EntryFields } from "@/lib/itinerary";
import { useLocaleFormatters } from "@/lib/localeFormatters";

type TravelEntry = EntryFields & { id: string };

function Detail({
  label,
  date,
  time,
  value,
}: {
  label: string;
  date?: string;
  time?: string;
  value?: string;
}) {
  const { formatExpenseDate } = useLocaleFormatters();
  if (!date && !time && !value) return null;
  return (
    <div className="min-w-0">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="flex flex-wrap gap-x-2 break-words text-ink">
        {date && <time dateTime={date}>{formatExpenseDate(date)}</time>}
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

export function TravelEntryDetails({ entry }: { entry: EntryFields }) {
  const { flight, lodging } = entry;
  if (!flight && !lodging) return null;
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
      {flight && (
        <>
          <Detail label="Flight number" value={flight.number} />
          <Detail label="Local departure time" time={flight.departureTime} />
          <Detail label="Local arrival time" time={flight.arrivalTime} />
        </>
      )}
      {lodging && (
        <>
          <Detail label="Local check-in" date={lodging.checkInDate} time={lodging.checkIn} />
          <Detail label="Local check-out" date={lodging.checkOutDate} time={lodging.checkOut} />
        </>
      )}
    </dl>
  );
}

export function ItineraryTravelSummary({ id, entries }: { id: string; entries: TravelEntry[] }) {
  const { formatExpenseDate } = useLocaleFormatters();
  const travel = entries
    .filter((entry) => entry.kind !== "event")
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || (a.time || "24:00").localeCompare(b.time || "24:00"),
    );
  if (!travel.length) return null;

  return (
    <Disclosure label="Flights and lodging">
      <div className="grid gap-6 sm:grid-cols-2">
        {(
          [
            ["flight", "Flights"],
            ["lodging", "Lodging"],
          ] as const
        ).map(([kind, label]) => {
          const items = travel.filter((entry) => entry.kind === kind);
          return (
            <section key={kind} className="min-w-0">
              <SectionTitle>{label}</SectionTitle>
              {items.length ? (
                <ul className="mt-2 divide-y divide-rule">
                  {items.map((entry) => (
                    <li key={entry.id} className="flex flex-col gap-2 py-3">
                      <GroupTitle>
                        <Link
                          to="/itineraries/$id"
                          params={{ id }}
                          search={{ day: entry.date }}
                          className={crumbLinkClass}
                        >
                          {entry.title}
                        </Link>
                      </GroupTitle>
                      <time dateTime={entry.date} className="text-sm text-ink-soft">
                        {formatExpenseDate(entry.date)}
                      </time>
                      <TravelEntryDetails entry={entry} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-ink-soft">
                  {kind === "flight" ? "No flights added." : "No lodging added."}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </Disclosure>
  );
}
