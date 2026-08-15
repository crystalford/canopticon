// Hashing, and the canonical form everything is hashed from.
//
// Extracted from the deleted `compile/hash.ts`, which hashed per PRIMITIVE.
// Nothing here knows what a primitive is. `canonicalJSON` is the load-bearing
// half: two records that differ only in key order must hash the same, or a
// film would recompile because a JSON serialiser felt different today.

/** Deterministic JSON: object keys sorted at every depth, `undefined` dropped. */
export function canonicalJSON(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJSON(v)}`).join(",")}}`;
}

export async function sha256Hex(input: string | ArrayBuffer | Uint8Array): Promise<string> {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : input instanceof Uint8Array
        ? input
        : new Uint8Array(input);
  // `.slice()` because subtle.digest wants an ArrayBuffer, and a Uint8Array
  // view over a larger buffer would hash the wrong bytes.
  const digest = await crypto.subtle.digest("SHA-256", bytes.slice().buffer as ArrayBuffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The hash of a whole record, through the canonical form. */
export async function hashRecord(value: unknown): Promise<string> {
  return sha256Hex(canonicalJSON(value));
}
