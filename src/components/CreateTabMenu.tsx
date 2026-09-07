import { type FormEvent, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Authenticated } from "convex/react";
import { Plus, Users2, X } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/Dialog";
import { useTabActions } from "@/lib/tabSync";
import { generateSlug } from "@/lib/slug";

const inputClass =
  "w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-margin-red/40";

interface CreateTabMenuProps {
  variant?: "button" | "icon" | "primary" | "none";
  onCreated?: (slug: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateTabMenu(props: CreateTabMenuProps) {
  return <Authenticated><CreateTabModal {...props} /></Authenticated>;
}

function CreateTabModal({ variant = "button", onCreated, open: controlledOpen, onOpenChange }: CreateTabMenuProps) {
  const navigate = useNavigate();
  const { create } = useTabActions();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  function setOpen(next: boolean) {
    setInternalOpen(next);
    onOpenChange?.(next);
  }
  const [name, setName] = useState("");
  const [memberNames, setMemberNames] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setName("");
    setMemberNames([]);
    setError(null);
    setSubmitting(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const slug = generateSlug();
      await create({ slug, name, memberNames });
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
            <button
              type="button"
              aria-label="New tab"
              title="New tab"
              className="rounded-md p-1 text-ink-soft transition hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
            />
          }
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
        </DialogTrigger>
      ) : (
        <DialogTrigger
          render={
            <button
              type="button"
              className={variant === "primary"
                ? "flex items-center gap-2 rounded-lg bg-forest px-5 py-3 font-display font-semibold text-surface transition hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
                : "mx-auto flex items-center gap-1.5 rounded-full border-2 border-forest px-5 py-2.5 font-display font-semibold text-forest transition hover:bg-forest hover:text-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"}
            />
          }
        >
          {variant === "primary" ? <Plus className="h-5 w-5" strokeWidth={2} /> : <Users2 className="h-4 w-4" strokeWidth={2.5} />}
          New tab
        </DialogTrigger>
      )}
      <DialogContent>
        <div className="mb-2 flex items-center justify-between gap-3">
          <DialogTitle>New tab</DialogTitle>
          <DialogClose aria-label="Close new tab" className="rounded-md p-1.5 text-ink-soft hover:text-ink"><X className="h-4 w-4" /></DialogClose>
        </div>
        <DialogDescription className="mb-5">You’re added automatically. Add other people below, or invite them later.</DialogDescription>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            required
            placeholder="Tab name"
            aria-label="Tab name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
          <div className="space-y-2">
            {memberNames.map((memberName, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="Other member (optional)"
                  value={memberName}
                  onChange={(e) =>
                    setMemberNames((prev) => prev.map((n, idx) => (idx === i ? e.target.value : n)))
                  }
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => setMemberNames((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label={`Remove member ${i + 1}`}
                  className="shrink-0 rounded-md p-1.5 text-ink-soft transition hover:text-margin-red"
                >
                  <X className="h-4 w-4" strokeWidth={2.25} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setMemberNames((prev) => [...prev, ""])}
            className="flex items-center gap-1 text-xs font-medium text-forest hover:text-ink"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            {memberNames.length === 0 ? "Add member" : "Add another member"}
          </button>
          {error && <p className="text-xs text-margin-red">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-forest px-3 py-2 text-sm font-semibold text-surface transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
          >
            {submitting ? "Creating…" : "Create tab"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
