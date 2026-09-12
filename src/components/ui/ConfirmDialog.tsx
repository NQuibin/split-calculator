import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/Dialog";

/**
 * The confirmation in front of a destructive action.
 *
 * Owns the pending and error state so a caller only supplies the work, and
 * keeps the dialog open when that work fails — a confirm that closes on error
 * looks like it succeeded. Must be rendered as a **sibling** of whatever opens
 * it, never inside an OverflowMenu (DESIGN.md § 6).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pendingLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  onConfirm: () => void | Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn’t work. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent aria-label={title}>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="mt-2">{description}</DialogDescription>
        {error && <p role="alert" className="mt-3 text-sm text-margin-red-ink">{error}</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <DialogClose disabled={pending} render={<Button variant="outline" size="touch" />}>
            Cancel
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            size="touch"
            disabled={pending}
            aria-busy={pending}
            onClick={handleConfirm}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />}
            {pending ? (pendingLabel ?? confirmLabel) : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
