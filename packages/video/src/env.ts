// Bindings + secrets the daily video Worker reads.

export interface Env {
  /** D1 — canopticon-video. Separate from the publication's DB. */
  DB: D1Database;
  /** R2 — broadcast clip cache + final MP4s. */
  ASSETS: R2Bucket;
  /** Workers AI — Phase 1 uses Whisper + the editorial brain. Phase 0
   *  doesn't call it; the binding is here so Phase 1 inherits the
   *  scaffolding. */
  AI: Ai;
  /** The Container running ffmpeg + Remotion (packages/video-renderer).
   *  Worker calls env.RENDER_CONTAINER.fetch("/render", { ... }) with
   *  the §7b segment JSON; the Container responds with the MP4's R2
   *  key plus timing/cost metrics. */
  RENDER_CONTAINER: DurableObjectNamespace;

  /** Shared HMAC secret. Same value as the publication's Worker so
   *  one session cookie recognises the operator on both subdomains.
   *  Set via `wrangler secret put SESSION_SECRET`. */
  SESSION_SECRET?: string;
  /** Server-to-server auth for POST /segments/from-reading — the
   *  publication's api Worker calls this endpoint directly (not
   *  through a browser, so no session cookie), authenticated by this
   *  shared token instead. Deliberately a SEPARATE secret from
   *  SESSION_SECRET, which signs session cookies — a different purpose
   *  shouldn't share a key. Same value must be set on both Workers via
   *  `wrangler secret put VIDEO_INTERNAL_TOKEN`. */
  VIDEO_INTERNAL_TOKEN?: string;
  /** ElevenLabs API key — Phase 1, opt-in per segment. */
  ELEVENLABS_API_KEY?: string;
  /** MiniMax API key — Phase 1, default voice provider. (If the
   *  Workers AI binding for MiniMax is enabled instead, this can stay
   *  unset.) */
  MINIMAX_API_KEY?: string;
  /** The publication's URL (canopticon.com). Used by /auth/login to
   *  redirect there for the Access challenge. */
  PUBLIC_BASE: string;
  /** This Worker's URL (video.canopticon.com). Used as the `next` param
   *  in the auth redirect. */
  VIDEO_BASE: string;

  LOG_LEVEL: string;
  OPERATOR_EMAIL: string;
}
