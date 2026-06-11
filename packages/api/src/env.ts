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
}
