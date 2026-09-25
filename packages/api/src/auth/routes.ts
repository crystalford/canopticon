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

import type { D1Database } from "@cloudflare/workers-types";
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

/** Just the bits of a Hono context this handler needs, so /op/ can pass its own. */
type LoginContext = {
  env: {
    SESSION_SECRET?: string | undefined;
    OPERATOR_EMAIL?: string | undefined;
    DB: D1Database;
    SESSION_COOKIE_DOMAIN?: string | undefined;
  };
  req: { raw: Request; query: (k: string) => string | undefined };
};

/**
 * A failure page that tells you what to do about it.
 *
 * Every failure here used to be c.text() — one line of unstyled plain text
 * with no link, no explanation and nothing to click. That is what the operator
 * hit, and it is indistinguishable from the site being broken. A sign-in that
 * cannot succeed must at minimum say why and what would fix it.
 */
function diagnosticPage(title: string, detail: string, steps: string[], status: number): Response {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(title)} — Canopticon</title>
<link rel="stylesheet" href="/styles.css" /></head>
<body data-mode="public">
<main class="container" style="max-width:640px;padding:64px 20px">
  <div class="eyebrow">Sign in</div>
  <h1 style="font-family:var(--serif);font-size:32px;line-height:1.15;margin:8px 0 14px">${esc(title)}</h1>
  <p class="lead">${esc(detail)}</p>
  <ul style="margin:22px 0;padding-left:1.2em;line-height:1.7">
${steps.map((x) => `    <li>${esc(x)}</li>`).join("\n")}
  </ul>
  <p><a href="/">← Back to the site</a></p>
</main></body></html>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

/** Which identity headers actually arrived, so the gap is visible not guessed. */
function headerSummary(req: Request): string {
  const names = [
    "cf-access-jwt-assertion",
    "cf-access-authenticated-user-email",
    "x-canopticon-jwt",
    "x-canopticon-email",
  ];
  const present = names.filter((n) => req.headers.get(n));
  return present.length ? present.join(", ") : "none of the Access identity headers";
}

/**
 * Sign in, wherever it is mounted.
 *
 * MOUNTED TWICE ON PURPOSE: at /auth/login and at /op/login.
 *
 * Minting a session needs Cloudflare Access to have verified the visitor and
 * injected their email. Access is scoped to an application PATH, and this
 * site's application covers /op/* and the admin API — it cannot cover /* ,
 * because the publication is meant to be publicly readable. So /auth/login
 * was never behind the gate it requires, no header ever arrived, and every
 * attempt to sign in returned a bare 401. The operator reported being unable
 * to reach the upload form four separate times; this is why.
 *
 * Mounting the same handler under /op/ puts it inside the prefix Access
 * already protects, so it works with no Cloudflare change at all.
 *
 * IT STILL FAILS CLOSED. The email must be present AND match OPERATOR_EMAIL.
 * An ungated mount cannot mint anything — it can only report that no email
 * arrived — so the second mount adds a working route, never a way in.
 */
async function handleLogin(c: LoginContext): Promise<Response> {
  const secret = c.env.SESSION_SECRET;
  if (!secret) {
    return diagnosticPage(
      "Sign-in is not configured",
      "SESSION_SECRET is not set on this Worker, so a session cannot be signed.",
      ["Run the “Set/rotate SESSION_SECRET” workflow in GitHub Actions, then try again."],
      503,
    );
  }
  const operatorEmail = c.env.OPERATOR_EMAIL;
  const email = readAccessEmail(c.req.raw);
  if (!email) {
    // Reached the handler without Access supplying an email, which means this
    // path is not inside the Access application. Refuse to mint a cookie and
    // SAY WHAT IS WRONG — a bare 401 is what made this invisible for weeks.
    return diagnosticPage(
      "Cloudflare Access did not identify you",
      "Signing in needs Cloudflare Access to verify who you are and pass your email to this Worker. No email arrived, which means this address is not covered by your Access application.",
      [
        "Try /op/login instead — it sits inside the /op/* path Access already protects.",
        "Or, in Cloudflare Zero Trust → Access → Applications → canopticon, add /auth/* to the application's paths.",
        `Headers that did arrive: ${headerSummary(c.req.raw)}`,
      ],
      401,
    );
  }
  if (operatorEmail && email.toLowerCase() !== operatorEmail.toLowerCase()) {
    return diagnosticPage(
      "Signed in as the wrong account",
      `Access identified you as ${email}, but this site's operator is ${operatorEmail}.`,
      ["Sign out of Cloudflare Access and sign back in with the operator address."],
      403,
    );
  }
  const uid = await getOrSeedOperator(c.env.DB, email);
  const cookie = await signSession(
    { uid, exp: Math.floor(Date.now() / 1000) + sessionTtlSeconds() },
    secret,
  );
  const next = c.req.query("next");
  // Only honour "next" when it's a same-origin path — prevents open-redirect
  // abuse from a crafted /auth/login?next=https://evil link. A second "/" OR
  // a backslash is refused: browsers parse "/\evil.com" as "//evil.com".
  const safeNext = next && /^\/(?![/\\])/.test(next) ? next : "/";
  return new Response(null, {
    status: 302,
    headers: {
      "Set-Cookie": buildSessionCookie(cookie, c.env.SESSION_COOKIE_DOMAIN),
      Location: safeNext,
    },
  });
}

/** The two mounts. See handleLogin for why there are two. */
app.get("/login", (c) => handleLogin(c));
export { handleLogin };

app.get("/logout", (c) => {
  return new Response(null, {
    status: 302,
    headers: {
      "Set-Cookie": buildClearSessionCookie(c.env.SESSION_COOKIE_DOMAIN),
      Location: "/",
    },
  });
});

export default app;
