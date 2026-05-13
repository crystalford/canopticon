// Cloudflare Access integration.
//
// Cloudflare Access sits in front of the operator app (configured in
// Zero Trust dashboard with a policy that gates by your email). When a
// request lands on a protected route, Access has already authenticated
// and injects two headers:
//
//   Cf-Access-Authenticated-User-Email: the verified email
//   Cf-Access-Jwt-Assertion: signed JWT proof (verifiable if needed)
//
// In Server Components we read those headers via next/headers. The
// browser doesn't need a token — Access cookies handle the session.

import { headers } from "next/headers";

export interface AccessUser {
  email: string;
  jwt: string | null;
}

export async function currentUser(): Promise<AccessUser | null> {
  const h = await headers();
  const headerEmail = h.get("cf-access-authenticated-user-email");
  const jwt = h.get("cf-access-jwt-assertion");
  // Some Access configurations forward only the JWT and not the parsed
  // identity headers. Fall back to decoding the JWT payload; Access has
  // already verified the signature before the request reaches us.
  const email = headerEmail ?? (jwt ? decodeJwtEmail(jwt) : null);
  if (!email) return null;
  return { email, jwt };
}

function decodeJwtEmail(jwt: string): string | null {
  try {
    const parts = jwt.split(".");
    if (parts.length < 2 || !parts[1]) return null;
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4;
    const b64 = pad ? padded + "=".repeat(4 - pad) : padded;
    const decoded =
      typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("utf8");
    const obj = JSON.parse(decoded) as Record<string, unknown>;
    const candidates: unknown[] = [
      obj.email,
      obj.user_email,
      (obj.identity as { email?: string } | undefined)?.email,
      (obj.custom as { email?: string } | undefined)?.email,
    ];
    for (const c of candidates) {
      if (typeof c === "string" && c.includes("@")) return c;
    }
    return null;
  } catch {
    return null;
  }
}

/** Use this in API calls from the browser. The cookie attached to the
 *  request is the Access session cookie; we just forward the JWT header
 *  so the Worker can trust the call. The browser doesn't need to know
 *  the JWT exists — the cookie is enough. */
export function attachAccessHeaders(headers: HeadersInit = {}): HeadersInit {
  // Browser → CF Pages → Worker: Access auto-injects the headers along
  // the way. We don't need to manually attach anything here. This stub
  // exists for symmetry with the previous Supabase auth client.
  return headers;
}
