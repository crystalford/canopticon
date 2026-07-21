// Auth gate for the Blind Spot instrument Worker. Reuses the shared
// session verifier (@canopticon/shared/auth) so the same cookie minted
// by the publication's /auth/login recognises the operator here.
//
// Every public page is readable anonymously — the instrument is public.
// Only /refresh (trigger an ingest) and /assets/:key (raw snapshot
// proxy) are operator-gated. Anonymous viewers hitting those get a 302
// to canopticon.com/auth/login with the current path as `next`;
// Cloudflare Access challenges on the apex, mints the cookie with
// `Domain=.canopticon.com`, and 302s the operator back here.

import { readSessionCookie, verifySession } from "@canopticon/shared/auth";
import type { Context } from "hono";
import type { Env } from "./env.ts";

export interface AuthState {
  is_operator: boolean;
  operator_id: string | null;
}

/** Verify the session cookie on the request. Returns the operator id on
 *  a valid signed cookie; anonymous otherwise. Never throws — bad or
 *  forged cookies silently fall through to anonymous. */
export async function readAuthState(req: Request, env: Env): Promise<AuthState> {
  if (!env.SESSION_SECRET) return { is_operator: false, operator_id: null };
  const cookie = readSessionCookie(req.headers.get("cookie") ?? undefined);
  if (!cookie) return { is_operator: false, operator_id: null };
  const payload = await verifySession(cookie, env.SESSION_SECRET);
  if (!payload) return { is_operator: false, operator_id: null };
  return { is_operator: true, operator_id: payload.uid };
}

/** Operator-only gate for a route handler. Sets is_operator/operator_id
 *  on the context and returns null when the operator is recognised;
 *  otherwise returns a 302 to the publication's login with the
 *  requested path as `next`. */
export async function requireOperator(
  c: Context<{ Bindings: Env; Variables: AuthState }>,
): Promise<Response | null> {
  const state = await readAuthState(c.req.raw, c.env);
  c.set("is_operator", state.is_operator);
  c.set("operator_id", state.operator_id);
  if (state.is_operator) return null;
  const next = encodeURIComponent(c.env.BLINDSPOT_BASE + c.req.path);
  return c.redirect(`${c.env.PUBLIC_BASE}/auth/login?next=${next}`, 302);
}
