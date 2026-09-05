"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

/**
 * A live camera viewfinder for taking a receipt photo in the page itself.
 *
 * Phones get the OS camera app instead (via an `<input capture>`, see
 * ExpenseImageField) - it takes better photos than a `getUserMedia` stream.
 * This is the desktop path, where `capture` is accepted but ignored by every
 * browser and a file picker is all you'd otherwise get.
 */
export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser can't open the camera here — upload a file instead.");
        return;
      }
      try {
        // `ideal` rather than `exact`: laptops only have a front camera, and
        // asking for a rear one outright would fail on them outright.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch (err) {
        // Permission denied, no camera attached, or the page isn't on a
        // secure origin - all land here, and all mean "use the file picker".
        setError(
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "Camera access was blocked — allow it in your browser, or upload a file instead."
            : "Couldn't open the camera — upload a file instead.",
        );
      }
    }

    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [stop]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function handleCapture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Couldn't capture that frame — try again.");
          return;
        }
        stop();
        onCapture(new File([blob], `receipt-${new Date().toISOString().slice(0, 10)}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Take a photo of the receipt"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-lg border border-rule bg-surface p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-1.5 font-display text-sm font-semibold tracking-wide text-ink uppercase">
            <Camera className="h-4 w-4 text-brass" strokeWidth={2.25} />
            Take a photo
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the camera"
            className="cursor-pointer rounded-md p-1.5 text-ink-soft transition hover:text-margin-red"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>

        {error ? (
          <p className="py-6 text-center text-sm text-margin-red">{error}</p>
        ) : (
          <div className="relative overflow-hidden rounded-md border border-rule bg-ink/90">
            <video ref={videoRef} autoPlay playsInline muted className="max-h-[60vh] w-full object-contain" />
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-surface" strokeWidth={2.5} />
              </div>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-sm font-medium text-ink-soft transition hover:text-margin-red"
          >
            Cancel
          </button>
          {!error && (
            <button
              type="button"
              onClick={handleCapture}
              disabled={!ready}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-forest px-4 py-2 text-sm font-semibold text-surface transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Camera className="h-4 w-4" strokeWidth={2.5} />
              Capture
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
