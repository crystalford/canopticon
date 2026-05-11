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
  const email = h.get("cf-access-authenticated-user-email");
  const jwt = h.get("cf-access-jwt-assertion");
  if (!email) return null;
  return { email, jwt };
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
