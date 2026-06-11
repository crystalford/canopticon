// /auth/login and /auth/logout — the operator's bootstrap path into the
// one-site permission model (spec v2.5 Part 9).
//
// Cloudflare Access gates /auth/* at the edge (configured infra-side, same
// way it gates /op/* today). When the operator reaches the handler, the JWT
// Access added to the request is the trust anchor: we read the email out of
// it, verify it matches OPERATOR_EMAIL, mint a signed session cookie, and
// redirect. From then on every public URL recognises the operator without
// further Access challenges.
//
// One-time visit, long-lived cookie (30 days). Logout clears the cookie.

import { Hono } from "hono";
import type { Env } from "../env.ts";
import { getOrSeedOperator } from "../lib/seed.ts";
import {
  buildClearSessionCookie,
  buildSessionCookie,
  sessionTtlSeconds,
  signSession,
} from "./session.ts";

const app = new Hono<{ Bindings: Env }>();

// Decode the JWT payload (Access already verified the signature at the
// edge) and pull out the email claim. Mirrors decodeJwtEmail in
// middleware.ts but kept local so this module owns its own bootstrap.
function readAccessEmail(req: Request): string | null {
  const jwt =
    req.headers.get("x-canopticon-jwt") ?? req.headers.get("cf-access-jwt-assertion") ?? null;
  if (!jwt) {
    // Fallback: a Pages-tier proxy may forward email under x-canopticon-email
    // or Access itself may set cf-access-authenticated-user-email on the
    // initial request. Either is acceptable since Access is the gate.
    return (
      req.headers.get("x-canopticon-email") ??
      req.headers.get("cf-access-authenticated-user-email") ??
      null
    );
  }
  const parts = jwt.split(".");
  if (parts.length < 2 || !parts[1]) return null;
  try {
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4;
    const b64 = pad ? padded + "=".repeat(4 - pad) : padded;
    const obj = JSON.parse(atob(b64)) as Record<string, unknown>;
    const candidates: unknown[] = [
      obj.email,
      obj.user_email,
      (obj.identity as { email?: string } | undefined)?.email,
      (obj.custom as { email?: string } | undefined)?.email,
    ];
    for (const c of candidates) if (typeof c === "string" && c.includes("@")) return c;
    return null;
  } catch {
    return null;
  }
}

app.get("/login", async (c) => {
  const secret = c.env.SESSION_SECRET;
  if (!secret) {
    return c.text("Session login is not configured (SESSION_SECRET missing).", 503);
  }
  const operatorEmail = c.env.OPERATOR_EMAIL;
  const email = readAccessEmail(c.req.raw);
  if (!email) {
    // Reached the handler without Access supplying an email = Access isn't
    // gating this route. Refuse to mint a cookie; the operator's setup is
    // broken upstream.
    return c.text(
      "Cloudflare Access did not provide an email. /auth/login must be gated by Access.",
      401,
    );
  }
  if (operatorEmail && email.toLowerCase() !== operatorEmail.toLowerCase()) {
    return c.text(`Only ${operatorEmail} can sign in here.`, 403);
  }
  const uid = await getOrSeedOperator(c.env.DB, email);
  const cookie = await signSession(
    { uid, exp: Math.floor(Date.now() / 1000) + sessionTtlSeconds() },
    secret,
  );
  const next = c.req.query("next");
  // Only honour "next" when it's a same-origin path — prevents open-redirect
  // abuse from a crafted /auth/login?next=https://evil link.
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/";
  return new Response(null, {
    status: 302,
    headers: {
      "Set-Cookie": buildSessionCookie(cookie),
      Location: safeNext,
    },
  });
});

app.get("/logout", () => {
  return new Response(null, {
    status: 302,
    headers: {
      "Set-Cookie": buildClearSessionCookie(),
      Location: "/",
    },
  });
});

export default app;
