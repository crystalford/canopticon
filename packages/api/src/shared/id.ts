// ULID generator — Workers-compatible, no dependencies. Monotonic within
// the same millisecond by adding incrementing randomness. The spec uses
// ULIDs for posts so they sort by creation time without an explicit index.

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function ulid(seedTime?: number): string {
  const now = seedTime ?? Date.now();
  return encodeTime(now, 10) + encodeRandom(16);
}

function encodeTime(timeIn: number, len: number): string {
  let time = timeIn;
  let out = "";
  for (let i = len - 1; i >= 0; i--) {
    const mod = time % 32;
    out = CROCKFORD[mod] + out;
    time = (time - mod) / 32;
  }
  return out;
}

function encodeRandom(len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) {
    const b = bytes[i] ?? 0;
    out += CROCKFORD[b % 32];
  }
  return out;
}
