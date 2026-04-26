// Tiny class-name joiner. Replaces a `clsx`/`classnames` dependency for
// the primitives layer — we need at most "truthy strings + maybe a record".

export type ClassValue = string | false | null | undefined | Record<string, boolean | undefined>;

export function cn(...values: ClassValue[]): string {
  const parts: string[] = [];
  for (const v of values) {
    if (!v) continue;
    if (typeof v === "string") {
      parts.push(v);
    } else {
      for (const [key, on] of Object.entries(v)) {
        if (on) parts.push(key);
      }
    }
  }
  return parts.join(" ");
}
