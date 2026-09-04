import type { Contribution, ExpenseItem, Person } from "./types";

export interface SharePayload {
  slug: string;
  people: Person[];
  items: ExpenseItem[];
  contributions: Contribution[];
}

function toBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(encoded.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeSharePayload(payload: SharePayload): string {
  return toBase64Url(JSON.stringify(payload));
}

export function decodeSharePayload(encoded: string): SharePayload | null {
  try {
    const payload = JSON.parse(fromBase64Url(encoded));
    if (
      payload &&
      typeof payload.slug === "string" &&
      Array.isArray(payload.people) &&
      Array.isArray(payload.items)
    ) {
      return payload as SharePayload;
    }
    return null;
  } catch {
    return null;
  }
}
