"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Authenticated } from "convex/react";
import { Plus, Users2, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { useGroupActions } from "@/lib/groupSync";
import { generateSlug } from "@/lib/slug";

const inputClass =
  "w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-margin-red/40";

export function CreateGroupMenu() {
  return (
    <Authenticated>
      <CreateGroupPopover />
    </Authenticated>
  );
}

function CreateGroupPopover() {
  const router = useRouter();
  const { create } = useGroupActions();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [memberNames, setMemberNames] = useState(["", ""]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setName("");
    setMemberNames(["", ""]);
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
      router.push(`/g/${slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the group.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            className="mx-auto flex cursor-pointer items-center gap-1.5 rounded-full border-2 border-forest px-5 py-2.5 font-display font-semibold text-forest transition hover:bg-forest hover:text-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
          />
        }
      >
        <Users2 className="h-4 w-4" strokeWidth={2.5} />
        New group
      </PopoverTrigger>
      <PopoverContent align="center" className="w-80 border border-rule bg-surface p-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            required
            placeholder="Group name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
          <div className="space-y-2">
            {memberNames.map((memberName, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  type="text"
                  required
                  placeholder={`Member ${i + 1}`}
                  value={memberName}
                  onChange={(e) =>
                    setMemberNames((prev) => prev.map((n, idx) => (idx === i ? e.target.value : n)))
                  }
                  className={inputClass}
                />
                {memberNames.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setMemberNames((prev) => prev.filter((_, idx) => idx !== i))}
                    aria-label={`Remove member ${i + 1}`}
                    className="shrink-0 cursor-pointer rounded-md p-1.5 text-ink-soft transition hover:text-margin-red"
                  >
                    <X className="h-4 w-4" strokeWidth={2.25} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setMemberNames((prev) => [...prev, ""])}
            className="flex cursor-pointer items-center gap-1 text-xs font-medium text-forest hover:text-ink"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Add another member
          </button>
          {error && <p className="text-xs text-margin-red">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full cursor-pointer rounded-md bg-forest px-3 py-2 text-sm font-semibold text-surface transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
          >
            {submitting ? "Creating…" : "Create group"}
          </button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
