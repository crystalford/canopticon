// Operator auth: gated by Cloudflare Access.
//
// In production, the Pages app proxies API calls to this Worker. Because
// Cloudflare strips `cf-access-*` headers when they arrive from a non-edge
// source (anti-spoofing), the proxy also forwards the email under
// `x-canopticon-email` and the JWT under `x-canopticon-jwt`. We accept
// any of these and fall back to decoding the JWT payload (Access already
// verified the signature before it reached the Pages tier).

import type { MiddlewareHandler } from "hono";
import type { Env } from "../env.ts";
import { forbidden, unauthorized } from "../lib/errors.ts";
import { getOrSeedOperator } from "../lib/seed.ts";
import { readSessionCookie, verifySession } from "./session.ts";

export interface AuthVariables {
  email: string;
  user_id: string;
}

/** Variables every route can read: whether THIS request is the operator and,
 *  if so, their user_id. attachAuthState (below) sets them on every request;
 *  anonymous = false/null. Lets renderers reveal logged-in affordances without
 *  changing routing. */
export interface SiteAuthVariables {
  is_operator: boolean;
  operator_id: string | null;
}

export type AuthContext = {
  Bindings: Env;
  Variables: AuthVariables & SiteAuthVariables & { trace_id: string };
};

function decodeJwtEmail(jwt: string): string | null {
  try {
    const parts = jwt.split(".");
    if (parts.length < 2 || !parts[1]) return null;
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4;
    const b64 = pad ? padded + "=".repeat(4 - pad) : padded;
    const decoded = atob(b64);
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

export const requireAuth = (): MiddlewareHandler<AuthContext> => async (c, next) => {
  let email =
    c.req.header("x-canopticon-email") ??
    c.req.header("cf-access-authenticated-user-email") ??
    decodeJwtEmailFromHeaders(c);

  // Service-token path. A Cloudflare Access *service token* (used by the
  // admin-probe GitHub Action) authenticates machine-to-machine: Access
  // validates the token at the edge and injects a signed JWT carrying a
  // `common_name` claim and no email. Single-operator app, so a valid
  // service-token JWT resolves to the sole operator.
  //
  // We require the JWT's common_name — NOT a bare cf-access-client-id
  // header. The JWT is signed by Access and cannot be spoofed; a raw
  // header can be (e.g. if the Worker is ever hit outside Access via its
  // workers.dev URL). The signature is the trust anchor.
  if (!email) {
    const serviceTokenName = decodeJwtCommonNameFromHeaders(c);
    if (serviceTokenName && c.env.OPERATOR_EMAIL) {
      email = c.env.OPERATOR_EMAIL;
    }
  }

  if (!email) {
    throw unauthorized("Cloudflare Access did not provide an email or service token");
  }
  const operatorEmail = c.env.OPERATOR_EMAIL;
  if (operatorEmail && email.toLowerCase() !== operatorEmail.toLowerCase()) {
    throw forbidden(`Only ${operatorEmail} can use this app`);
  }

  const userId = await getOrSeedOperator(c.env.DB, email);
  c.set("email", email);
  c.set("user_id", userId);
  await next();
};

function decodeJwtEmailFromHeaders(c: {
  req: { header: (n: string) => string | undefined };
}): string | null {
  const jwt = c.req.header("x-canopticon-jwt") ?? c.req.header("cf-access-jwt-assertion");
  if (!jwt) return null;
  return decodeJwtEmail(jwt);
}

// Service-token JWTs carry the token name under `common_name` (and no
// email). Decode it the same way — Access already verified the signature.
function decodeJwtCommonName(jwt: string): string | null {
  try {
    const parts = jwt.split(".");
    if (parts.length < 2 || !parts[1]) return null;
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4;
    const b64 = pad ? padded + "=".repeat(4 - pad) : padded;
    const obj = JSON.parse(atob(b64)) as Record<string, unknown>;
    const cn = obj.common_name ?? (obj.custom as { common_name?: string } | undefined)?.common_name;
    return typeof cn === "string" && cn.length > 0 ? cn : null;
  } catch {
    return null;
  }
}

function decodeJwtCommonNameFromHeaders(c: {
  req: { header: (n: string) => string | undefined };
}): string | null {
  const jwt = c.req.header("x-canopticon-jwt") ?? c.req.header("cf-access-jwt-assertion");
  if (!jwt) return null;
  return decodeJwtCommonName(jwt);
}

/** Optional auth: looks at the session cookie (set by /auth/login after
 *  Cloudflare Access challenges) and decides if THIS request is the operator.
 *  Anonymous viewers pass through with `is_operator=false`. Routes that
 *  conditionally reveal affordances read `c.get("is_operator")`.
 *
 *  Mounted on the public site (the one-site permission model — spec v2.5
 *  Part 9). NEVER throws: a bad/missing/expired cookie is silently anonymous,
 *  not an error. */
export const attachAuthState = (): MiddlewareHandler<AuthContext> => async (c, next) => {
  const secret = c.env.SESSION_SECRET;
  const cookie = readSessionCookie(c.req.header("cookie"));
  let isOperator = false;
  let operatorId: string | null = null;
  if (secret && cookie) {
    const payload = await verifySession(cookie, secret);
    if (payload) {
      isOperator = true;
      operatorId = payload.uid;
    }
  }
  c.set("is_operator", isOperator);
  c.set("operator_id", operatorId);
  await next();
};
