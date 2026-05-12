// Same-origin proxy for the Cloudflare Worker API.
//
// Browser calls /api/v1/... (same origin → no CORS preflight issue).
// This edge function forwards the request to the Worker, injecting
// the Cloudflare Access email header so the Worker's requireAuth()
// can identify the user without the browser needing Access cookies
// on the api.canopticon.com domain.

export const runtime = "edge";

import { type NextRequest } from "next/server";
import { headers } from "next/headers";

const WORKER = "https://api.canopticon.com";

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
  const h = await headers();
  const email = h.get("cf-access-authenticated-user-email");

  // Rebuild the URL including any query string from the original request.
  const target = `${WORKER}/${path.join("/")}${req.nextUrl.search}`;

  const fwdHeaders: Record<string, string> = {};
  // Forward the Access-verified email so the Worker can identify the user.
  if (email) fwdHeaders["cf-access-authenticated-user-email"] = email;
  const ct = req.headers.get("content-type");
  if (ct) fwdHeaders["content-type"] = ct;
  const accept = req.headers.get("accept");
  if (accept) fwdHeaders["accept"] = accept;

  const init: RequestInit = { method: req.method, headers: fwdHeaders };
  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "DELETE") {
    init.body = req.body;
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (err) {
    return Response.json({ error: { code: "proxy_error", message: String(err) } }, { status: 502 });
  }

  const resHeaders = new Headers();
  for (const key of ["content-type", "cache-control", "x-accel-buffering"]) {
    const val = upstream.headers.get(key);
    if (val) resHeaders.set(key, val);
  }

  // Pass the body through as a stream — critical for SSE chat responses.
  return new Response(upstream.body, { status: upstream.status, headers: resHeaders });
}
