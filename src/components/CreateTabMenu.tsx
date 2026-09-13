import { type FormEvent, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Authenticated } from "convex/react";
import { Plus, Users2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/Dialog";
import { useTabActions } from "@/lib/tabSync";
import { generateSlug } from "@/lib/slug";

interface CreateTabMenuProps {
  variant?: "button" | "icon" | "primary" | "none";
  onCreated?: (slug: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateTabMenu(props: CreateTabMenuProps) {
  return (
    <Authenticated>
      <CreateTabModal {...props} />
    </Authenticated>
  );
}

function CreateTabModal({
  variant = "button",
  onCreated,
  open: controlledOpen,
  onOpenChange,
}: CreateTabMenuProps) {
  const navigate = useNavigate();
  const { create } = useTabActions();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  function setOpen(next: boolean) {
    setInternalOpen(next);
    onOpenChange?.(next);
  }
  const [name, setName] = useState("");
  // Each draft row carries its own id so removing a row keeps the remaining
  // inputs (and their focus) attached to the same React element.
  const [memberDrafts, setMemberDrafts] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setName("");
    setMemberDrafts([]);
    setError(null);
    setSubmitting(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const slug = generateSlug();
      await create({ slug, name, memberNames: memberDrafts.map((draft) => draft.name) });
      setOpen(false);
      resetForm();
      if (onCreated) onCreated(slug);
      else void navigate({ to: "/t/$slug", params: { slug } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the tab.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      {variant === "none" ? null : variant === "icon" ? (
        <DialogTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="New tab"
              title="New tab"
              className="text-ink-soft hover:text-forest"
            />
          }
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
        </DialogTrigger>
      ) : (
        <DialogTrigger
          render={
            variant === "primary" ? (
              <Button type="button" size="touch" />
            ) : (
              // The empty-state call to action: an outlined pill that fills on
              // hover, rather than a second filled button competing with the
              // page's own primary.
              <Button
                type="button"
                variant="outline"
                size="hero"
                className="mx-auto rounded-full border-2 border-forest bg-transparent text-forest hover:bg-forest hover:text-surface"
              />
            )
          }
        >
          {variant === "primary" ? (
            <Plus className="h-5 w-5" strokeWidth={2} />
          ) : (
            <Users2 className="h-4 w-4" strokeWidth={2.5} />
          )}
          New tab
        </DialogTrigger>
      )}
      <DialogContent>
        <div className="mb-2 flex items-center justify-between gap-3">
          <DialogTitle>New tab</DialogTitle>
          <DialogClose
            aria-label="Close new tab"
            render={<Button variant="ghost" size="icon-touch" className="text-ink-soft" />}
          >
            <X className="h-4 w-4" />
          </DialogClose>
        </div>
        <DialogDescription className="mb-5">
          You’re added automatically. Add other people below, or invite them later.
        </DialogDescription>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="text"
            required
            placeholder="Tab name"
            aria-label="Tab name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="space-y-2">
            {memberDrafts.map((draft, i) => (
              <div key={draft.id} className="flex items-center gap-1.5">
                <Input
                  type="text"
                  placeholder="Other member (optional)"
                  value={draft.name}
                  onChange={(e) =>
                    setMemberDrafts((prev) =>
                      prev.map((entry) =>
                        entry.id === draft.id ? { ...entry, name: e.target.value } : entry,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-touch"
                  onClick={() =>
                    setMemberDrafts((prev) => prev.filter((entry) => entry.id !== draft.id))
                  }
                  aria-label={`Remove member ${i + 1}`}
                  className="shrink-0 text-ink-soft hover:text-margin-red-ink"
                >
                  <X className="h-4 w-4" strokeWidth={2.25} />
                </Button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="link"
            size="xs"
            onClick={() =>
              setMemberDrafts((prev) => [...prev, { id: crypto.randomUUID(), name: "" }])
            }
            className="h-auto px-0 text-xs no-underline hover:text-ink hover:no-underline"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            {memberDrafts.length === 0 ? "Add member" : "Add another member"}
          </Button>
          {error && (
            <p role="alert" className="text-xs text-margin-red-ink">
              {error}
            </p>
          )}
          <Button
            type="submit"
            size="lg"
            disabled={submitting}
            aria-busy={submitting}
            className="w-full"
          >
            {submitting ? "Creating…" : "Create tab"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
