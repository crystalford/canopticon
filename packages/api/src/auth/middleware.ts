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

export interface AuthVariables {
  email: string;
  user_id: string;
}

export type AuthContext = {
  Bindings: Env;
  Variables: AuthVariables & { trace_id: string };
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
  const email =
    c.req.header("x-canopticon-email") ??
    c.req.header("cf-access-authenticated-user-email") ??
    decodeJwtEmailFromHeaders(c);

  if (!email) {
    throw unauthorized("Cloudflare Access did not provide an email");
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
