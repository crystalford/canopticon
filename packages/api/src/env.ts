// Worker bindings and environment variables.

export interface Env {
  // Bindings (declared in wrangler.toml).
  DB: D1Database;
  FILES: R2Bucket;
  EMBEDDINGS: VectorizeIndex;

  // Anthropic.
  ANTHROPIC_API_KEY: string;

  // The single operator's email — Cloudflare Access gates the operator
  // app to this email. Public site is unauthenticated.
  OPERATOR_EMAIL: string;

  // openparliament.ca user-agent (only used if cron ingestion enabled).
  OPENPARLIAMENT_USER_AGENT?: string;

  LOG_LEVEL: string;
}
