// Bindings + secrets the Blind Spot instrument Worker reads.

export interface Env {
  /** D1 — canopticon-blindspot. The typed store of official wealth
   *  statistics, snapshots, and the computed Invisibility Index.
   *  Separate from the publication's + video's databases. */
  DB: D1Database;
  /** R2 — the provenance store. Every source pull is snapshotted here;
   *  every fact row carries the R2 key of the snapshot it was read from.
   *  Nothing is published that isn't traceable to a stored snapshot. */
  ASSETS: R2Bucket;
  /** Workers AI — reserved for later phases. v1 ingest is pure fetch +
   *  parse; the binding is here so future phases inherit scaffolding. */
  AI: Ai;

  /** Shared HMAC secret. Same value as the publication's Worker so one
   *  session cookie recognises the operator on both subdomains. Set via
   *  `wrangler secret put SESSION_SECRET`. */
  SESSION_SECRET?: string;

  /** The publication's URL (canopticon.com). /auth/login + /refresh
   *  redirect there for the Cloudflare Access challenge. */
  PUBLIC_BASE: string;
  /** This Worker's URL (blindspot.canopticon.com). Used as the `next`
   *  target in the auth redirect. */
  BLINDSPOT_BASE: string;
  /** PBO high-net-worth family database download URL. Empty until the
   *  operator confirms the live URL; the PBO adapter falls back to a
   *  documented 2023 snapshot when unset. */
  PBO_HNW_URL?: string;

  LOG_LEVEL: string;
  OPERATOR_EMAIL: string;
}
