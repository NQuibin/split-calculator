"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Camera, ChevronDown, FileText, ImagePlus, Loader2, Paperclip, Trash2 } from "lucide-react";
import { IMAGE_ACCEPT } from "../../convex/imageFormats";
import { CameraCapture } from "@/components/CameraCapture";
import { useUploadExpenseImage } from "@/lib/expenseSync";
import type { ExpenseImage } from "@/lib/types";

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

interface ExpenseImageFieldProps {
  image?: ExpenseImage;
  onChange: (image: ExpenseImage | null) => void;
  /** Uploads go to Convex storage, which needs an account - guests get an explanation instead of the buttons. */
  canUpload: boolean;
}

export function ExpenseImageField({ image, onChange, canUpload }: ExpenseImageFieldProps) {
  const upload = useUploadExpenseImage();
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(() => !!image);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  // A just-uploaded file has no signed URL yet (the expense may not even be
  // saved), so preview it straight from the local file until the server's
  // URL arrives on the next read.
  const [localPreview, setLocalPreview] = useState<{ storageId: string; url: string } | null>(null);
  const localPreviewUrl = useRef<string | null>(null);

  function replaceLocalPreview(next: { storageId: string; url: string } | null) {
    if (localPreviewUrl.current) URL.revokeObjectURL(localPreviewUrl.current);
    localPreviewUrl.current = next?.url ?? null;
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
    setUploading(true);
    try {
      const uploaded = await upload(file);
      replaceLocalPreview(
        file.type.startsWith("image/") ? { storageId: uploaded.storageId, url: URL.createObjectURL(file) } : null,
      );
      onChange(uploaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that file.");
    } finally {
      setUploading(false);
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
    onChange(null);
  }

  const previewUrl = localPreview?.storageId === image?.storageId ? localPreview?.url : image?.url;
  const isPdf = image?.type === "application/pdf";

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
            {image ? "Receipt" : "Add a receipt"}
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

                    {image &&
                      (isPdf || !previewUrl ? (
                        <a
                          href={image.url ?? undefined}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink transition hover:border-forest hover:text-forest"
                        >
                          <FileText className="h-4 w-4 shrink-0 text-brass" strokeWidth={2.25} />
                          <span className="truncate">{image.name}</span>
                        </a>
                      ) : (
                        <a href={image.url ?? previewUrl} target="_blank" rel="noreferrer" className="block">
                          {/* eslint-disable-next-line @next/next/no-img-element -- a signed, per-read Convex storage URL, so there's no stable host for next/image to optimize. */}
                          <img
                            src={previewUrl}
                            alt={image.name}
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
                        disabled={uploading}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-rule px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-forest hover:text-forest disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {uploading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.5} />
                        ) : (
                          <ImagePlus className="h-3.5 w-3.5" strokeWidth={2.5} />
                        )}
                        {image ? "Replace file" : "Upload a file"}
                      </button>
                      <button
                        type="button"
                        onClick={handleTakePhoto}
                        disabled={uploading}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-rule px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-forest hover:text-forest disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <Camera className="h-3.5 w-3.5" strokeWidth={2.5} />
                        Take a photo
                      </button>
                      {image && !uploading && (
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
