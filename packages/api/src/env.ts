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

  // Cloudflare AI Gateway with Unified Billing — the preferred way to run
  // Claude. When set, `env.AI.run("anthropic/<model>", …, { gateway: { id } })`
  // bills prepaid Cloudflare credits: no Anthropic account, no key in the
  // Worker. Every judgement role in llm/router.ts prefers Claude through
  // this gateway when it is configured (docs/the-record.md §3). Empty or
  // unset means every role stays on Workers AI and the library header says
  // so — nothing silently downgrades.
  AI_GATEWAY_ID?: string;

  // The exact `anthropic/…` model name the gateway lists. Defaults to
  // DEFAULT_CLAUDE_MODEL below; only the operator can confirm the live
  // name, so it is a var, not a constant.
  CLAUDE_MODEL?: string;

  // The workspace (/admin/write) reaches Claude through the gateway's
  // Anthropic pass-through (…/anthropic/v1/messages), which carries tools and
  // prompt caching where env.AI.run() does not. A gateway with Unified
  // Billing must be authenticated; this is its token, sent as
  // cf-aig-authorization. Set with AI_GATEWAY_ID and CLOUDFLARE_ACCOUNT_ID,
  // the workspace bills Cloudflare credits and needs no Anthropic key.
  CF_AIG_TOKEN?: string;

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

  // Brave Search is gone (2026-11-07): web search is Cloudflare's, through
  // SEARCH_GATEWAY_ID. A BRAVE_SEARCH_API_KEY secret left on the Worker is read
  // by nothing.
  // The AI Gateway that Cloudflare's Web Search runs through (the workspace's
  // web_search on Workers AI). Its own setting, apart from AI_GATEWAY_ID:
  // that one also moves the processing pipeline onto Claude. Named in
  // wrangler.toml [vars]; the gateway itself is created once in the dashboard.
  SEARCH_GATEWAY_ID?: string;
  // Which of Cloudflare's search partners to ask; empty means its default.
  SEARCH_PROVIDER?: string;
  // "1" lets the retired cron handler run; anything else and a scheduled
  // tick does nothing (rule 4: nothing runs unattended).
  CRON_ENABLED?: string;

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

  // Toggle for graph/lib/deep-research.ts's synthesis writer: "anthropic"
  // routes it to Claude instead of Workers AI's gpt-oss-120b. Defaults to
  // (and falls back to on any other value) Workers AI — this is meant to
  // stay off until the operator deliberately wants to spend on Claude.
  // Flipping it alone does nothing unless a cost_whitelists row also
  // exists for operation_type 'anthropic.research_writer' (see
  // llm/router.ts's callResearchWriter) — the cost gate denies anything
  // unwhitelisted by default, so this can't accidentally start spending.
  RESEARCH_LLM_PROVIDER?: string;
  // Mail. Absent means nothing sends — see lib/email.ts on why that is the
  // deliberate behaviour rather than a half-configured one. The sending
  // domain must also be verified with the provider or every send is rejected.
  RESEND_API_KEY?: string;
  /** The sender's postal address, printed in every email. Canada's anti-spam
   *  law requires one in the consent request and in every message, so with
   *  none set nothing is sent at all (docs/blackbox/BACKEND.md §5). */
  MAILING_ADDRESS?: string;
  // Cloudflare Web Analytics beacon token — optional. Free, no cookies,
  // billed to nothing. When set, public/layout.ts emits the beacon script
  // before </body>; when empty, nothing is emitted and every page reads
  // exactly the same without it (rule 7: no JavaScript required to read).
  CF_WEB_ANALYTICS_TOKEN?: string;
  /** IndexNow key (Worker secret). lib/indexnow.ts is inert without it. */
  INDEXNOW_KEY?: string;
}

// The Claude model used through the AI Gateway when CLAUDE_MODEL is unset.
// The operator sets the exact name the gateway's dashboard lists (the set
// changes as Anthropic ships models — "anthropic/claude-opus-4.1",
// "anthropic/claude-sonnet-4.5", "anthropic/claude-haiku-4.5" were the
// names at the time of writing). Opus-tier on purpose: every step that runs
// through it is a judgement, and docs/the-record.md §3 says the most
// capable Claude the gateway lists.
export const DEFAULT_CLAUDE_MODEL = "anthropic/claude-opus-4.1";
