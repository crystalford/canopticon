// Worker bindings and environment variables.

export interface Env {
  // Bindings (declared in wrangler.toml).
  DB: D1Database;
  FILES: R2Bucket;
  EMBEDDINGS: VectorizeIndex;
  AI: Ai;

  // Anthropic — optional escape hatch. When unset, Workers AI handles
  // every role.
  ANTHROPIC_API_KEY: string;

  // The single operator's email — Cloudflare Access gates the operator
  // app to this email. Public site is unauthenticated for readers; the
  // operator is recognised on public URLs via a session cookie (see below).
  OPERATOR_EMAIL: string;

  // HMAC secret used to sign the operator session cookie minted by
  // /auth/login. Set as a Worker secret. When unset, the public site can
  // still serve anonymous traffic — only the operator login flow is
  // disabled. (Spec v2.5 Part 9 — the one-site permission model.)
  SESSION_SECRET?: string;

  // Domain attribute on the operator session cookie. In production this
  // is ".canopticon.com" so the cookie is recognised on both
  // canopticon.com (publication) and video.canopticon.com (daily video
  // engine — separate Worker, same SESSION_SECRET). Left undefined in
  // local dev / tests so Set-Cookie doesn't carry a Domain attribute
  // the test harness can't satisfy.
  SESSION_COOKIE_DOMAIN?: string;

  // openparliament.ca user-agent (only used if cron ingestion enabled).
  OPENPARLIAMENT_USER_AGENT?: string;

  LOG_LEVEL: string;

  // Feature flag: toggles the Graph compartment. When "false", graph tools
  // are hidden from the chat and the CMS publish path skips its graph hook.
  // CMS works standalone in either mode.
  GRAPH_ENABLED: string;

  // Feature flag: toggles the Studio compartment (audio production).
  // When "false", studio tools are hidden from chat and the /studio route
  // shows the placeholder. CMS/Graph work standalone in either mode.
  STUDIO_ENABLED: string;

  // Cloudflare Browser Rendering — optional. When configured, the
  // web_search / web_fetch_rendered tools become available (confirm-required,
  // paid). Wikipedia tools work without these. Set CLOUDFLARE_ACCOUNT_ID as
  // a public var in wrangler.toml and CLOUDFLARE_API_TOKEN as a Worker secret
  // with `Browser Rendering Edit` permission.
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;

  // Brave Search API key — optional. Powers record-building on click
  // (spec v2.5 Part 23): when the logged-in operator clicks a thin Record,
  // the worker calls Brave Search for the subject name, fetches the found
  // pages, and runs the same extraction pipeline over them. Without this
  // key, the "Expand this Record" affordance is visible but inert (shows
  // a "key not configured" notice). Set with `wrangler secret put
  // BRAVE_SEARCH_API_KEY`.
  BRAVE_SEARCH_API_KEY?: string;

  // The video Worker's URL (video.canopticon.com) — where "Produce video
  // essay" POSTs a signed reading's content, and where the public /videos
  // section fetches the published-segments list from. Optional: without
  // it, the produce action is visible but inert (same "wired, secret
  // missing" pattern as BRAVE_SEARCH_API_KEY above) and /videos shows an
  // honest empty state instead of erroring.
  VIDEO_BASE?: string;
  // Server-to-server auth for POST {VIDEO_BASE}/segments/from-reading.
  // Same value as the video Worker's VIDEO_INTERNAL_TOKEN secret — set
  // with `wrangler secret put VIDEO_INTERNAL_TOKEN` on BOTH Workers.
  VIDEO_INTERNAL_TOKEN?: string;
}
