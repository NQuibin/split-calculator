import { OptionPicker } from "@/components/ui/OptionPicker";
import { ConvexError } from "convex/values";
import { type FormEvent, type ReactNode, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/Dialog";
import { Field, FieldError, Input, Textarea } from "@/components/ui/Input";

import { type EntryKind, entryKinds, entrySubtypes, subtypeLabel } from "@/lib/itineraryCategories";
import { type EntryFields, itineraryError } from "@/lib/itinerary";

type TripFields = { title: string; startDate: string; endDate: string };

function EditorDialog({
  title,
  onClose,
  onSave,
  children,
}: {
  title: string;
  onClose: () => void;
  onSave: (form: FormData) => Promise<void>;
  children: ReactNode;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError("");
    setPending(true);
    try {
      await onSave(new FormData(event.currentTarget));
      onClose();
    } catch (err) {
      setError(itineraryError(err, "Couldn’t save your changes. Try again."));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <form className="mt-5 space-y-4" onSubmit={submit}>
          <fieldset className="space-y-4" disabled={pending}>
            {children}
          </fieldset>
          {error && <FieldError>{error}</FieldError>}
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose disabled={pending} render={<Button variant="secondary" size="touch" />}>
              Cancel
            </DialogClose>
            <Button type="submit" size="touch" disabled={pending} aria-busy={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TripDialog({
  trip,
  onClose,
  onSave,
}: {
  trip?: TripFields;
  onClose: () => void;
  onSave: (fields: TripFields) => Promise<void>;
}) {
  return (
    <EditorDialog
      title={trip ? "Edit itinerary" : "New itinerary"}
      onClose={onClose}
      onSave={(form) =>
        onSave({
          title: String(form.get("title")).trim(),
          startDate: String(form.get("startDate")),
          endDate: String(form.get("endDate")),
        })
      }
    >
      <Field htmlFor="trip-title" label="Itinerary name">
        <Input id="trip-title" name="title" required defaultValue={trip?.title} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor="trip-start" label="Start date">
          <Input
            id="trip-start"
            type="date"
            name="startDate"
            required
            defaultValue={trip?.startDate}
          />
        </Field>
        <Field htmlFor="trip-end" label="End date">
          <Input id="trip-end" type="date" name="endDate" required defaultValue={trip?.endDate} />
        </Field>
      </div>
    </EditorDialog>
  );
}

const entryHints = {
  flight: "Airline, airports, or arrival details",
  lodging: "Booking or arrival instructions",
};

export function EntryDialog({
  entry,
  date,
  startDate,
  endDate,
  onClose,
  onSave,
}: {
  entry?: EntryFields;
  date: string;
  startDate: string;
  endDate: string;
  onClose: () => void;
  onSave: (fields: EntryFields) => Promise<void>;
}) {
  const [kind, setKind] = useState<EntryKind>(entry?.kind ?? "event");
  const subtypes = entrySubtypes[kind];
  const [subtype, setSubtype] = useState(entry?.subtype ?? "");
  const isFlight = kind === "travel" && subtype === "flight";
  const hasLocation = !isFlight;
  return (
    <EditorDialog
      title={entry ? "Edit timeline entry" : "Add timeline entry"}
      onClose={onClose}
      onSave={async (form) => {
        const name = String(form.get("locationName") ?? "").trim();
        const url = String(form.get("locationUrl") ?? "").trim();
        if (hasLocation && url && !name) {
          throw new ConvexError("Enter a location name or address for the link.");
        }
        const number = String(form.get("flightNumber") ?? "").trim();
        const departureTime = String(form.get("departureTime") ?? "");
        const arrivalTime = String(form.get("arrivalTime") ?? "");
        const departureCity = String(form.get("departureCity") ?? "").trim();
        const departureAirportCode = String(form.get("departureAirportCode") ?? "").trim();
        const destinationCity = String(form.get("destinationCity") ?? "").trim();
        const destinationAirportCode = String(form.get("destinationAirportCode") ?? "").trim();
        const checkInDate = String(form.get("checkInDate") ?? "");
        const checkOutDate = String(form.get("checkOutDate") ?? "");
        const checkIn = String(form.get("checkIn") ?? "");
        const checkOut = String(form.get("checkOut") ?? "");
        await onSave({
          title: String(form.get("title")).trim(),
          date: String(form.get("date")),
          time: String(form.get("time")),
          kind,
          subtype: subtype || undefined,
          details: String(form.get("details")).trim(),
          flight: isFlight
            ? {
                number: number || undefined,
                departureTime: departureTime || undefined,
                arrivalTime: arrivalTime || undefined,
                departureCity: departureCity || undefined,
                departureAirportCode: departureAirportCode || undefined,
                destinationCity: destinationCity || undefined,
                destinationAirportCode: destinationAirportCode || undefined,
              }
            : undefined,
          lodging:
            kind === "lodging" && (checkIn || checkOut || checkInDate || checkOutDate)
              ? {
                  checkIn: checkIn || undefined,
                  checkOut: checkOut || undefined,
                  checkInDate: checkInDate || undefined,
                  checkOutDate: checkOutDate || undefined,
                }
              : undefined,
          location: hasLocation && name ? { name, ...(url && { url }) } : undefined,
        });
      }}
    >
      <Field htmlFor="entry-kind" label="Type">
        <OptionPicker
          id="entry-kind"
          value={kind}
          options={(Object.keys(entryKinds) as EntryKind[]).map((value) => ({
            value,
            label: entryKinds[value],
          }))}
          onChange={(value) => {
            if (value === kind) return;
            setKind(value);
            setSubtype("");
          }}
        />
      </Field>
      {subtypes.length > 0 && (
        <Field htmlFor="entry-subtype" label="Subtype (optional)">
          <OptionPicker
            id="entry-subtype"
            value={subtype}
            options={[
              { value: "", label: "None" },
              ...subtypes.map((value) => ({ value, label: subtypeLabel(value) })),
            ]}
            onChange={setSubtype}
          />
        </Field>
      )}
      <Field htmlFor="entry-title" label="Title">
        <Input id="entry-title" name="title" required defaultValue={entry?.title} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor="entry-date" label="Date">
          <Input
            id="entry-date"
            type="date"
            name="date"
            required
            min={startDate}
            max={endDate}
            defaultValue={entry?.date ?? date}
          />
        </Field>
        <Field
          htmlFor="entry-time"
          label={isFlight ? "Local timeline time (optional)" : "Local time (optional)"}
        >
          <Input id="entry-time" type="time" name="time" defaultValue={entry?.time} />
        </Field>
      </div>
      <fieldset
        hidden={!isFlight}
        disabled={!isFlight}
        className="space-y-2 border-t border-rule pt-3"
      >
        <legend className="text-sm font-semibold text-ink">Flight details</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            htmlFor="entry-flight-number"
            label="Flight number (optional)"
            className="sm:col-span-2"
          >
            <Input
              id="entry-flight-number"
              name="flightNumber"
              maxLength={32}
              defaultValue={entry?.flight?.number}
            />
          </Field>
          <FlightAirportFields
            endpoint="departure"
            city={entry?.flight?.departureCity}
            code={entry?.flight?.departureAirportCode}
          />
          <FlightAirportFields
            endpoint="destination"
            city={entry?.flight?.destinationCity}
            code={entry?.flight?.destinationAirportCode}
          />
          <Field htmlFor="entry-departure-time" label="Local departure time (optional)">
            <Input
              id="entry-departure-time"
              name="departureTime"
              type="time"
              defaultValue={entry?.flight?.departureTime}
            />
          </Field>
          <Field htmlFor="entry-arrival-time" label="Local arrival time (optional)">
            <Input
              id="entry-arrival-time"
              name="arrivalTime"
              type="time"
              defaultValue={entry?.flight?.arrivalTime}
            />
          </Field>
        </div>
      </fieldset>
      <fieldset hidden={!hasLocation} disabled={!hasLocation} className="space-y-4">
        <legend className={kind === "lodging" ? "mb-2 text-sm font-semibold text-ink" : "sr-only"}>
          {kind === "lodging" ? "Lodging details" : "Entry location"}
        </legend>
        <Field htmlFor="entry-location" label="Location or address (optional)">
          <Input
            id="entry-location"
            name="locationName"
            defaultValue={entry?.location?.name}
            maxLength={200}
          />
        </Field>
        <Field htmlFor="entry-location-url" label="Location link (optional)">
          <Input
            id="entry-location-url"
            name="locationUrl"
            type="url"
            defaultValue={entry?.location?.url}
            maxLength={2000}
            placeholder="https://"
          />
        </Field>
        <div hidden={kind !== "lodging"}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field htmlFor="entry-check-in-date" label="Check-in date (optional)">
              <Input
                id="entry-check-in-date"
                name="checkInDate"
                type="date"
                defaultValue={entry?.lodging?.checkInDate}
                disabled={kind !== "lodging"}
              />
            </Field>
            <Field htmlFor="entry-check-in" label="Local check-in time (optional)">
              <Input
                id="entry-check-in"
                name="checkIn"
                type="time"
                defaultValue={entry?.lodging?.checkIn}
                disabled={kind !== "lodging"}
              />
            </Field>
            <Field htmlFor="entry-check-out-date" label="Check-out date (optional)">
              <Input
                id="entry-check-out-date"
                name="checkOutDate"
                type="date"
                defaultValue={entry?.lodging?.checkOutDate}
                disabled={kind !== "lodging"}
              />
            </Field>
            <Field htmlFor="entry-check-out" label="Local check-out time (optional)">
              <Input
                id="entry-check-out"
                name="checkOut"
                type="time"
                defaultValue={entry?.lodging?.checkOut}
                disabled={kind !== "lodging"}
              />
            </Field>
          </div>
        </div>
      </fieldset>
      <Field htmlFor="entry-details" label="Details (optional)">
        <Textarea
          id="entry-details"
          name="details"
          rows={4}
          defaultValue={entry?.details}
          placeholder={
            isFlight
              ? entryHints.flight
              : kind === "lodging"
                ? entryHints.lodging
                : "Cost or plans for the day"
          }
        />
      </Field>
    </EditorDialog>
  );
}

function FlightAirportFields({
  endpoint,
  city,
  code,
}: {
  endpoint: "departure" | "destination";
  city?: string;
  code?: string;
}) {
  const label = endpoint === "departure" ? "Departure" : "Destination";
  return (
    <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
      <Field htmlFor={`entry-${endpoint}-city`} label={`${label} city (optional)`}>
        <Input
          id={`entry-${endpoint}-city`}
          name={`${endpoint}City`}
          maxLength={100}
          defaultValue={city}
        />
      </Field>
      <Field htmlFor={`entry-${endpoint}-code`} label={`${label} airport code (optional)`}>
        <Input
          id={`entry-${endpoint}-code`}
          name={`${endpoint}AirportCode`}
          maxLength={4}
          pattern="[A-Za-z0-9]{3,4}"
          autoCapitalize="characters"
          defaultValue={code}
        />
      </Field>
    </div>
  );
}
