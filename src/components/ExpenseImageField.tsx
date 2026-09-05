"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Camera, ChevronDown, FileText, ImagePlus, Loader2, Paperclip, Trash2 } from "lucide-react";
import { IMAGE_ACCEPT } from "../../convex/imageFormats";
import { CameraCapture } from "@/components/CameraCapture";
import { assertUploadableImage } from "@/lib/expenseSync";

const collapseTransition = { duration: 0.2, ease: "easeInOut" as const };

// `<input capture>` only does anything on phones and tablets - desktop
// browsers accept the attribute and then open a plain file picker - so the
// OS camera app is used where it actually works, and everywhere else the
// photo is taken in-page from a getUserMedia stream. A coarse pointer is the
// usable proxy for "the OS camera will open here"; feature-detecting
// `capture` doesn't work, since desktop Chrome reports supporting it.
function prefersNativeCamera(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
}

// A PDF (and an image whose preview hasn't resolved) shows as a filename row.
// It's only a link once the file is actually in storage - a receipt still
// waiting on the expense's first save has nothing to open yet.
function ReceiptFileRow({ name, href }: { name: string; href?: string | null }) {
  const className =
    "flex items-center gap-2 rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink transition";
  const content = (
    <>
      <FileText className="h-4 w-4 shrink-0 text-brass" strokeWidth={2.25} />
      <span className="truncate">{name}</span>
    </>
  );

  if (!href) return <div className={className}>{content}</div>;
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`${className} hover:border-forest hover:text-forest`}>
      {content}
    </a>
  );
}

/** What the field has to show, whether it's already in storage or still just a file in memory. */
export interface ReceiptSummary {
  name: string;
  type: string;
  /** Signed storage URL, once there is one. A file that hasn't been uploaded yet previews from a local object URL instead. */
  url?: string | null;
}

interface ExpenseImageFieldProps {
  receipt?: ReceiptSummary;
  /**
   * Called with the picked file, or null to remove. What happens next is the
   * caller's call - a saved expense uploads right away, a draft holds the
   * file until it's first saved - so this awaits the returned promise for
   * the busy state and shows anything it throws.
   */
  onPick: (file: File | null) => void | Promise<void>;
  /** Uploads go to Convex storage, which needs an account - guests get an explanation instead of the buttons. */
  canUpload: boolean;
}

export function ExpenseImageField({ receipt, onPick, canUpload }: ExpenseImageFieldProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(() => !!receipt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  // A picked file has no signed URL - it may not be uploaded yet, and even
  // once it is, the URL only arrives with the next read - so it previews
  // from the local file until then.
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const localPreviewUrl = useRef<string | null>(null);

  function replaceLocalPreview(next: string | null) {
    if (localPreviewUrl.current) URL.revokeObjectURL(localPreviewUrl.current);
    localPreviewUrl.current = next;
    setLocalPreview(next);
  }

  useEffect(
    () => () => {
      if (localPreviewUrl.current) URL.revokeObjectURL(localPreviewUrl.current);
    },
    [],
  );

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      assertUploadableImage(file);
      // Shown before the await, so an upload that takes a few seconds still
      // previews immediately; dropped again if the pick doesn't go through.
      replaceLocalPreview(file.type.startsWith("image/") ? URL.createObjectURL(file) : null);
      await onPick(file);
    } catch (err) {
      replaceLocalPreview(null);
      setError(err instanceof Error ? err.message : "Couldn't attach that file.");
    } finally {
      setBusy(false);
    }
  }

  function handleTakePhoto() {
    setError(null);
    if (prefersNativeCamera()) {
      cameraInput.current?.click();
    } else {
      setCameraOpen(true);
    }
  }

  function handleRemove() {
    replaceLocalPreview(null);
    setError(null);
    void onPick(null);
  }

  const previewUrl = receipt?.url ?? localPreview;
  const isPdf = receipt?.type === "application/pdf";

  return (
    <>
      {/* Kept outside the collapsible panel below: the panel animates its
          height with a transform, which would make it the containing block
          for this fixed overlay and clip it to the panel's box. */}
      {cameraOpen && (
        <CameraCapture
          onCapture={(file) => {
            setCameraOpen(false);
            void handleFile(file);
          }}
          onClose={() => setCameraOpen(false)}
        />
      )}

      <div className="mt-4 rounded-md border border-rule transition has-[button:hover]:border-forest">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-ink"
        >
          <span className="flex items-center gap-1.5">
            <Paperclip className="h-4 w-4 text-brass" strokeWidth={2.25} />
            {receipt ? "Receipt" : "Add a receipt"}
          </span>
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={collapseTransition}
            className="shrink-0"
          >
            <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={collapseTransition}
              className="overflow-hidden border-t border-rule"
            >
              <div className="space-y-3 px-4 py-3">
                {canUpload ? (
                  <>
                    <p className="text-xs text-ink-soft">
                      Optional — a photo or PDF of the receipt, up to 5MB.
                    </p>

                    {receipt &&
                      (isPdf || !previewUrl ? (
                        <ReceiptFileRow name={receipt.name} href={receipt.url} />
                      ) : (
                        <a href={previewUrl} target="_blank" rel="noreferrer" className="block">
                          {/* eslint-disable-next-line @next/next/no-img-element -- a signed, per-read Convex storage URL, so there's no stable host for next/image to optimize. */}
                          <img
                            src={previewUrl}
                            alt={receipt.name}
                            className="max-h-64 w-full rounded-md border border-rule object-contain"
                          />
                        </a>
                      ))}

                    <input
                      ref={fileInput}
                      type="file"
                      accept={IMAGE_ACCEPT}
                      hidden
                      onChange={(e) => {
                        void handleFile(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                    <input
                      ref={cameraInput}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      hidden
                      onChange={(e) => {
                        void handleFile(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => fileInput.current?.click()}
                        disabled={busy}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-rule px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-forest hover:text-forest disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.5} />
                        ) : (
                          <ImagePlus className="h-3.5 w-3.5" strokeWidth={2.5} />
                        )}
                        {receipt ? "Replace file" : "Upload a file"}
                      </button>
                      <button
                        type="button"
                        onClick={handleTakePhoto}
                        disabled={busy}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-rule px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-forest hover:text-forest disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <Camera className="h-3.5 w-3.5" strokeWidth={2.5} />
                        Take a photo
                      </button>
                      {receipt && !busy && (
                        <button
                          type="button"
                          onClick={handleRemove}
                          className="flex cursor-pointer items-center gap-1 text-xs font-medium text-ink-soft transition hover:text-margin-red"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                          Remove
                        </button>
                      )}
                    </div>

                    {error && <p className="text-xs text-margin-red">{error}</p>}
                  </>
                ) : (
                  <p className="text-xs text-ink-soft">
                    Sign in to attach a receipt — files are stored with your account.
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
