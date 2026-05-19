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
  // app to this email. Public site is unauthenticated.
  OPERATOR_EMAIL: string;

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
}
