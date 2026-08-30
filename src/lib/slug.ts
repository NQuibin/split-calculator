const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

export function generateSlug(length = 8): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
