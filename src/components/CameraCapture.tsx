import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/Dialog";

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
    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
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
          stream.getTracks().forEach((track) => {
            track.stop();
          });
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

  function handleCapture() {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
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
        onCapture(
          new File([blob], `receipt-${new Date().toISOString().slice(0, 10)}.jpg`, {
            type: "image/jpeg",
          }),
        );
      },
      "image/jpeg",
      0.92,
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <div className="mb-3 flex items-center justify-between">
          <DialogTitle className="flex items-center gap-1.5 text-sm tracking-wide uppercase">
            <Camera className="h-4 w-4 text-brass" strokeWidth={2.25} />
            Take a photo
          </DialogTitle>
          <Button
            type="button"
            variant="ghost"
            size="icon-touch"
            onClick={onClose}
            aria-label="Close the camera"
            className="text-ink-soft"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </Button>
        </div>

        {error ? (
          <p className="py-6 text-center text-sm text-margin-red-ink">{error}</p>
        ) : (
          <div className="relative overflow-hidden rounded-md border border-rule bg-ink/90">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="max-h-[60vh] w-full object-contain"
            />
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-surface" strokeWidth={2.5} />
              </div>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center justify-end gap-3">
          <Button type="button" variant="outline" size="touch" onClick={onClose}>
            Cancel
          </Button>
          {!error && (
            <Button type="button" size="touch" onClick={handleCapture} disabled={!ready}>
              <Camera className="h-4 w-4" strokeWidth={2.5} />
              Capture
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
