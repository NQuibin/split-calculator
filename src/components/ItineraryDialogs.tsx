import { ConvexError } from "convex/values";
import { type FormEvent, type ReactNode, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/Dialog";
import { Field, FieldError, Input, Select, Textarea } from "@/components/ui/Input";

import { type EntryFields, entryKinds, itineraryError } from "@/lib/itinerary";

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
  event: "Cost or plans for the day",
  flight: "Airline, airports, or arrival details",
  lodging: "Property, address, and check-in or checkout details",
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
  const [kind, setKind] = useState<keyof typeof entryKinds>(entry?.kind ?? "event");
  return (
    <EditorDialog
      title={entry ? "Edit timeline entry" : "Add timeline entry"}
      onClose={onClose}
      onSave={async (form) => {
        const name = String(form.get("locationName") ?? "").trim();
        const url = String(form.get("locationUrl") ?? "").trim();
        if (kind === "event" && url && !name) {
          throw new ConvexError("Enter a location name or address for the link.");
        }
        const number = String(form.get("flightNumber") ?? "").trim();
        const departureTime = String(form.get("departureTime") ?? "");
        await onSave({
          title: String(form.get("title")).trim(),
          date: String(form.get("date")),
          time: String(form.get("time")),
          kind,
          details: String(form.get("details")).trim(),
          flight:
            kind === "flight" && (number || departureTime)
              ? { number: number || undefined, departureTime: departureTime || undefined }
              : undefined,
          location: kind === "event" && name ? { name, ...(url && { url }) } : undefined,
        });
      }}
    >
      <Field htmlFor="entry-kind" label="Type">
        <Select
          id="entry-kind"
          value={kind}
          onChange={(event) => setKind(event.target.value as keyof typeof entryKinds)}
        >
          {Object.entries(entryKinds).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
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
          label={kind === "flight" ? "Local timeline time (optional)" : "Local time (optional)"}
        >
          <Input id="entry-time" type="time" name="time" defaultValue={entry?.time} />
        </Field>
      </div>
      <fieldset
        hidden={kind !== "flight"}
        disabled={kind !== "flight"}
        className="space-y-2 border-t border-rule pt-3"
      >
        <legend className="text-sm font-semibold text-ink">Flight details</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="entry-flight-number" label="Flight number (optional)">
            <Input
              id="entry-flight-number"
              name="flightNumber"
              maxLength={32}
              defaultValue={entry?.flight?.number}
            />
          </Field>
          <Field htmlFor="entry-departure-time" label="Local departure time (optional)">
            <Input
              id="entry-departure-time"
              name="departureTime"
              type="time"
              defaultValue={entry?.flight?.departureTime}
            />
          </Field>
        </div>
      </fieldset>
      <div hidden={kind !== "event"} className="space-y-4">
        <Field htmlFor="entry-location" label="Location or address (optional)">
          <Input
            id="entry-location"
            name="locationName"
            defaultValue={entry?.location?.name}
            disabled={kind !== "event"}
            maxLength={200}
          />
        </Field>
        <Field htmlFor="entry-location-url" label="Location link (optional)">
          <Input
            id="entry-location-url"
            name="locationUrl"
            type="url"
            defaultValue={entry?.location?.url}
            disabled={kind !== "event"}
            maxLength={2000}
            placeholder="https://"
          />
        </Field>
      </div>
      <Field htmlFor="entry-details" label="Details (optional)">
        <Textarea
          id="entry-details"
          name="details"
          rows={4}
          defaultValue={entry?.details}
          placeholder={entryHints[kind]}
        />
      </Field>
    </EditorDialog>
  );
}
