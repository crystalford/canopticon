// Operator session — shared HMAC-SHA256 cookie verifier.
//
// Lifted out of packages/api/src/auth/session.ts so the daily video
// engine Worker (packages/video) can verify the same cookie without
// duplicating crypto. Both Workers receive the same SESSION_SECRET and
// recognise the same operator across `canopticon.com` and
// `video.canopticon.com` once the cookie is scoped to `.canopticon.com`.
//
// Cookie format: `<base64url(payload)>.<base64url(hmac)>` — payload is
// JSON {uid, exp}; hmac is HMAC-SHA256 over the payload. No external
// library; Web Crypto handles everything.

const COOKIE_NAME = "canopticon_op";
const SESSION_TTL_SEC = 60 * 60 * 24 * 30; // 30 days

export interface SessionPayload {
  /** Operator user_id (the same id seeded by getOrSeedOperator). */
  uid: string;
  /** Expiry — unix seconds. */
  exp: number;
}

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? s : s + "=".repeat(4 - (s.length % 4));
  const bin = atob(pad.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signSession(payload: SessionPayload, secret: string): Promise<string> {
  const json = JSON.stringify(payload);
  const payloadBytes = new TextEncoder().encode(json);
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, payloadBytes));
  return `${b64urlEncode(payloadBytes)}.${b64urlEncode(sig)}`;
}

/** Verify + decode a session cookie value. Returns the payload only when
 *  the signature is valid AND the session hasn't expired. */
export async function verifySession(
  cookie: string,
  secret: string,
): Promise<SessionPayload | null> {
  const dot = cookie.indexOf(".");
  if (dot < 0) return null;
  try {
    const payloadBytes = b64urlDecode(cookie.slice(0, dot));
    const sig = b64urlDecode(cookie.slice(dot + 1));
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify("HMAC", key, sig, payloadBytes);
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as SessionPayload;
    if (typeof payload.uid !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Build the Set-Cookie header value for a fresh session. Pass `domain`
 *  to make the cookie cross-subdomain (e.g. ".canopticon.com" so both
 *  the publication and the video Worker see it). Omit for local dev /
 *  tests where Set-Cookie with a domain attribute is finicky. */
export function buildSessionCookie(value: string, domain?: string): string {
  const parts = [
    `${COOKIE_NAME}=${value}`,
    `Max-Age=${SESSION_TTL_SEC}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ];
  if (domain) parts.push(`Domain=${domain}`);
  return parts.join("; ");
}

/** Build the Set-Cookie header value that clears the session (logout).
 *  Mirrors `buildSessionCookie`'s domain handling so the clear hits the
 *  same scope the original cookie was set on. */
export function buildClearSessionCookie(domain?: string): string {
  const parts = [`${COOKIE_NAME}=`, "Max-Age=0", "Path=/", "HttpOnly", "Secure", "SameSite=Lax"];
  if (domain) parts.push(`Domain=${domain}`);
  return parts.join("; ");
}

/** Pluck the session cookie out of the Cookie header. */
export function readSessionCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${COOKIE_NAME}=`)) {
      const v = trimmed.slice(COOKIE_NAME.length + 1);
      return v.length > 0 ? v : null;
    }
  }
  return null;
}

export function sessionTtlSeconds(): number {
  return SESSION_TTL_SEC;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
