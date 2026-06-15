// Auth gate for the daily video Worker. Reuses the shared session
// verifier (@canopticon/shared/auth) so the same cookie minted by the
// publication's /auth/login recognises the operator here.
//
// Anonymous viewers get a 302 to canopticon.com/auth/login with the
// current path as `next`. Cloudflare Access challenges on the apex,
// mints the cookie with `Domain=.canopticon.com`, and 302s the
// operator back here — recognised on arrival.

import { readSessionCookie, verifySession } from "@canopticon/shared/auth";
import type { Context } from "hono";
import type { Env } from "./env.ts";

export interface AuthState {
  is_operator: boolean;
  operator_id: string | null;
}

/** Verify the session cookie on the request. Returns the operator id
 *  on a valid signed cookie; null otherwise. Never throws — bad cookies
 *  silently fall through to anonymous. */
export async function readAuthState(req: Request, env: Env): Promise<AuthState> {
  if (!env.SESSION_SECRET) return { is_operator: false, operator_id: null };
  const cookie = readSessionCookie(req.headers.get("cookie") ?? undefined);
  if (!cookie) return { is_operator: false, operator_id: null };
  const payload = await verifySession(cookie, env.SESSION_SECRET);
  if (!payload) return { is_operator: false, operator_id: null };
  return { is_operator: true, operator_id: payload.uid };
}

/** Operator-only gate for a route handler. Redirects anonymous viewers
 *  to canopticon.com/auth/login with the requested path as `next`. */
export async function requireOperator(
  c: Context<{ Bindings: Env; Variables: AuthState }>,
): Promise<Response | null> {
  const state = await readAuthState(c.req.raw, c.env);
  c.set("is_operator", state.is_operator);
  c.set("operator_id", state.operator_id);
  if (state.is_operator) return null;
  const next = encodeURIComponent(c.env.VIDEO_BASE + c.req.path);
  return c.redirect(`${c.env.PUBLIC_BASE}/auth/login?next=${next}`, 302);
}
