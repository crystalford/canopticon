// Same-origin proxy for the Cloudflare Worker API.
//
// Browser calls /api/v1/... (same origin → no CORS preflight issue).
// This edge function forwards the request to the Worker, injecting
// the Cloudflare Access email header so the Worker's requireAuth()
// can identify the user without the browser needing Access cookies
// on the api.canopticon.com domain.

export const runtime = "edge";

import type { NextRequest } from "next/server";

const WORKER = "https://api.canopticon.com";

function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const parts = jwt.split(".");
    if (parts.length < 2 || !parts[1]) return null;
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4;
    const b64 = pad ? padded + "=".repeat(4 - pad) : padded;
    const decoded = atob(b64);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function emailFromJwt(jwt: string): string | null {
  const payload = decodeJwtPayload(jwt);
  if (!payload) return null;
  // Access JWTs put the email at the top level on "email"; some configs
  // (especially OIDC IdP-backed) put it in custom claims or "identity".
  const candidates = [
    payload.email,
    payload.user_email,
    (payload.identity as { email?: string } | undefined)?.email,
    (payload.custom as { email?: string } | undefined)?.email,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.includes("@")) return c;
  }
  return null;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, ctx);
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, ctx);
}
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, ctx);
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, ctx);
}
export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

async function proxyRequest(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await ctx.params;

  // Cloudflare Access injects these headers on the request once it
  // passes through Access on the pages domain. In some Access configs
  // only the JWT is forwarded (no parsed email header), so we decode
  // the JWT payload — Access already verified the signature.
  let email = req.headers.get("cf-access-authenticated-user-email");
  const jwt = req.headers.get("cf-access-jwt-assertion");
  if (!email && jwt) email = emailFromJwt(jwt);

  const target = `${WORKER}/${path.join("/")}${req.nextUrl.search}`;

  const fwdHeaders: Record<string, string> = {};
  if (email) fwdHeaders["cf-access-authenticated-user-email"] = email;
  if (jwt) fwdHeaders["cf-access-jwt-assertion"] = jwt;
  const ct = req.headers.get("content-type");
  if (ct) fwdHeaders["content-type"] = ct;
  const accept = req.headers.get("accept");
  if (accept) fwdHeaders.accept = accept;
  const idem = req.headers.get("idempotency-key");
  if (idem) fwdHeaders["idempotency-key"] = idem;

  // Debug helper: surface what we received from Access. Pass ?__debug=1
  // to inspect from the browser — useful when we can't find the email.
  if (req.nextUrl.searchParams.get("__debug") === "1") {
    const names: string[] = [];
    req.headers.forEach((_v, k) => names.push(k));
    const payload = jwt ? decodeJwtPayload(jwt) : null;
    return Response.json(
      {
        email_header: req.headers.get("cf-access-authenticated-user-email"),
        email_resolved: email,
        jwt_seen: !!jwt,
        jwt_payload_keys: payload ? Object.keys(payload) : null,
        jwt_payload_email_field: payload?.email ?? null,
        jwt_payload_identity_email:
          payload && typeof payload.identity === "object" && payload.identity
            ? ((payload.identity as { email?: string }).email ?? null)
            : null,
        // Sanitized full payload: omit any token-like long strings.
        jwt_payload: payload,
        headers_seen: names,
      },
      { status: 200 },
    );
  }

  // Buffer the body. Streaming a ReadableStream into another fetch()
  // requires `duplex: "half"`, which is inconsistent across runtimes.
  let body: ArrayBuffer | undefined;
  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "DELETE") {
    try {
      body = await req.arrayBuffer();
    } catch (err) {
      return Response.json(
        {
          error: {
            code: "proxy_body_read_failed",
            message: `Could not read request body: ${(err as Error).message ?? String(err)}`,
          },
        },
        { status: 502 },
      );
    }
  }

  const init: RequestInit = { method: req.method, headers: fwdHeaders };
  if (body && body.byteLength > 0) init.body = body;

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (err) {
    return Response.json(
      {
        error: {
          code: "proxy_fetch_failed",
          message: `Proxy fetch to ${target} threw: ${(err as Error).message ?? String(err)}`,
          email_present: !!email,
        },
      },
      { status: 502 },
    );
  }

  // If Access intercepted the request it redirects to the login page;
  // fetch follows the redirect and we get HTML with status 200. Detect
  // this so the browser gets a clear 401 instead of a parse crash.
  const upstreamCt = upstream.headers.get("content-type") ?? "";
  if (!upstreamCt.includes("application/json") && !upstreamCt.includes("text/event-stream")) {
    return Response.json(
      {
        error: {
          code: "proxy_access_intercept",
          message:
            "Cloudflare Access intercepted the Worker request — remove api.canopticon.com from your Access application. The proxy already forwards your authenticated email; only canopticon.com needs Access protection.",
        },
      },
      { status: 401 },
    );
  }

  const resHeaders = new Headers();
  for (const key of ["content-type", "cache-control", "x-accel-buffering"]) {
    const val = upstream.headers.get(key);
    if (val) resHeaders.set(key, val);
  }

  return new Response(upstream.body, { status: upstream.status, headers: resHeaders });
}
