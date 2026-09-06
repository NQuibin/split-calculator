// Shared by the Convex schema/mutations and the browser-side upload form, so
// the two can't drift on what counts as an acceptable receipt file. Plain
// constants only - no Convex imports - so pulling this into the client bundle
// doesn't drag the server runtime along with it.

/** Content types accepted for an expense's image - the popular photo formats, plus PDF for emailed receipts. */
export const IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** `accept` attribute for the file inputs. */
export const IMAGE_ACCEPT = IMAGE_CONTENT_TYPES.join(",");

export function isAcceptedImageType(type: string): boolean {
  return (IMAGE_CONTENT_TYPES as readonly string[]).includes(type);
}
