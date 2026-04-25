// Worker bindings and environment variables.
//
// Bindings (R2, Durable Objects, KV) are defined in wrangler.toml and surface
// as properties on `Env`. Secrets (ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY)
// are set via `wrangler secret put` and surface here as plain strings.

export interface Env {
  // Supabase
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;

  // Anthropic
  ANTHROPIC_API_KEY: string;

  // openparliament.ca
  OPENPARLIAMENT_USER_AGENT: string;

  // Misc
  LOG_LEVEL: string;

  // Bindings — uncommented as they come online.
  // SOURCES: R2Bucket;
  // CASCADE_RUN: DurableObjectNamespace;
}
