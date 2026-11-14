import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import { type FormEvent, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Field, FieldError, Input } from "@/components/ui/Input";
import { itineraryError } from "@/lib/itinerary";

export function ItineraryShareDialog({
  id,
  owner,
  onClose,
}: {
  id: Id<"itineraries">;
  owner: boolean;
  onClose: () => void;
}) {
  const [link] = useState(() => window.location.href);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [revoking, setRevoking] = useState<{ userId: Id<"users">; label: string }>();
  const { data: editors, isError } = useQuery(
    convexQuery(api.itineraries.listEditors, owner ? { id } : "skip"),
  );
  const invite = useMutation(api.itineraries.inviteEditor);
  const remove = useMutation(api.itineraries.removeEditor);

  async function changeAccess(work: () => Promise<unknown>, message: string) {
    setPending(true);
    setError("");
    setStatus("");
    try {
      await work();
      setStatus(message);
    } catch (err) {
      setError(itineraryError(err, "Couldn’t update editor access. Try again."));
    } finally {
      setPending(false);
    }
  }

  async function addEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = String(new FormData(form).get("email")).trim();
    await changeAccess(async () => {
      await invite({ id, email });
      form.reset();
    }, "Editor access granted.");
  }

  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent>
          <DialogTitle>Share itinerary</DialogTitle>
          <DialogDescription className="mt-2">
            Anyone with this link can view the full itinerary.
          </DialogDescription>
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <Field htmlFor="itinerary-share-link" label="View link" className="min-w-0 flex-1">
              <Input
                id="itinerary-share-link"
                value={link}
                readOnly
                onFocus={(event) => event.currentTarget.select()}
              />
            </Field>
            <Button
              variant="secondary"
              size="touch"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setStatus("Link copied.");
                } catch {
                  setStatus("Select the link to copy it manually.");
                }
              }}
            >
              Copy link
            </Button>
          </div>
          {owner && (
            <div className="mt-5 space-y-3 border-t border-rule pt-4">
              <form className="flex flex-wrap items-end gap-2" onSubmit={addEditor}>
                <Field
                  htmlFor="itinerary-editor-email"
                  label="Verified Ventura account email"
                  className="min-w-0 flex-1"
                >
                  <Input
                    id="itinerary-editor-email"
                    name="email"
                    type="email"
                    required
                    disabled={pending}
                  />
                </Field>
                <Button type="submit" size="touch" disabled={pending} aria-busy={pending}>
                  Invite editor
                </Button>
              </form>
              {isError ? (
                <FieldError>Couldn’t load editors.</FieldError>
              ) : editors?.length ? (
                <ul aria-label="Itinerary editors" className="divide-y divide-rule">
                  {editors.map(({ userId, name, email }) => (
                    <li key={userId} className="flex items-center justify-between gap-2 py-2">
                      <span className="min-w-0 break-words text-sm">{name || email}</span>
                      <Button
                        size="touch"
                        variant="destructive"
                        disabled={pending}
                        onClick={() =>
                          setRevoking({ userId, label: name || email || "this editor" })
                        }
                      >
                        Remove access
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
          {error && <FieldError>{error}</FieldError>}
          <p role="status" className="mt-2 text-sm text-ink-soft">
            {status}
          </p>
          <div className="mt-4 flex justify-end">
            <DialogClose render={<Button variant="secondary" size="touch" />}>Done</DialogClose>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={Boolean(revoking)}
        onOpenChange={(open) => {
          if (!open) setRevoking(undefined);
        }}
        title="Remove editor access?"
        description={`${revoking?.label ?? "This editor"} will still be able to view the itinerary with its link.`}
        confirmLabel="Remove access"
        pendingLabel="Removing…"
        onConfirm={async () => {
          if (!revoking) return;
          await remove({ id, userId: revoking.userId });
          setError("");
          setStatus("Editor access removed.");
        }}
      />
    </>
  );
}
