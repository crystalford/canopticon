// Public site routes. Server-rendered HTML, no JS required to read.
// Mounted at `/` in the Worker root (packages/api/src/index.ts).
//
// Phase 2: the five primary destinations read live from D1. Detail
// pages (topic hub, piece, entity) fall through to the styled 404 when
// the slug doesn't resolve. Empty D1 renders graceful empty states —
// the surfaces work before the seed corpus lands.

import { Hono } from "hono";
import type { AuthContext } from "../auth/middleware";
import { listPublishedQuestions } from "../graph/lib/aeo-extract";
import { all, one } from "../lib/d1";
import { getPieceBySlug, listPublishedPieces, resolveOperatorId } from "./data";
import { htmlResponse } from "./layout";
import { feedJson, llmsTxt, pieceMarkdown } from "./machine";
import { renderAbout } from "./render/about";
import { renderActivityPage } from "./render/activity";
import { renderAnswerPage, renderAnswersIndex } from "./render/answers";
import { renderBriefPage } from "./render/brief";
import { renderCitationsPage } from "./render/citations";
import { renderFront } from "./render/front";
import { renderEssaysIndex, renderResearchIndex } from "./render/indexes";
import { renderInstrumentsIndex } from "./render/instruments";
import { renderInvestigationsIndex, renderLibraryIndex } from "./render/investigations";
import { renderMethodology } from "./render/methodology";
import { renderPiece } from "./render/piece-template";
import { renderNotFound } from "./render/placeholder";
import { renderEntityPage } from "./render/record";
import { renderSearchPage } from "./render/search";
import {
  renderConfirmed,
  renderSubscribeError,
  renderSubscribed,
  renderUnsubscribed,
} from "./render/subscribe";
import { renderTopicHub, renderTopicsIndex } from "./render/topics";
import { renderVideosPage } from "./render/videos";
import { renderWatchlistPage } from "./render/watchlist";
import studioRoutes from "./studio/routes";
import { STYLES_CSS, stylesHash } from "./styles";

// The public site reads is_operator / operator_id from the Hono context
// (set by attachAuthState in index.ts) so renderers can reveal logged-in
// affordances on the SAME URLs that serve anonymous readers. AuthContext
// happens to carry the same shape; we don't enforce its email/user_id
// fields here — those are only set by the hard-auth path on /v1/* routes.
const app = new Hono<AuthContext>();

// ---- citation tracker (spec Part 14 #10) ----------------------------------
// AI crawlers fetching public pages = the leading indicator of citation.
// Best-effort fire-and-forget logging; never blocks or fails a render.
// One list, two consumers: the `agents` are what robots.txt names in its
// allow-list, the `re` is what the tracker below matches a live User-Agent
// against. They were separate before, which meant the file could invite a
// crawler the analytics didn't count, or count one it never invited.
const AI_CRAWLERS: Array<{ agents: string[]; re: RegExp; key: string }> = [
  { agents: ["GPTBot"], re: /GPTBot/i, key: "gptbot" },
  { agents: ["OAI-SearchBot"], re: /OAI-SearchBot/i, key: "oai-search" },
  { agents: ["ChatGPT-User"], re: /ChatGPT-User/i, key: "chatgpt-user" },
  {
    agents: ["ClaudeBot", "Claude-Web", "Claude-SearchBot", "anthropic-ai"],
    re: /ClaudeBot|Claude-Web|Claude-SearchBot|anthropic-ai/i,
    key: "claudebot",
  },
  { agents: ["PerplexityBot"], re: /PerplexityBot/i, key: "perplexity" },
  { agents: ["Google-Extended"], re: /Google-Extended/i, key: "google-extended" },
  { agents: ["Applebot-Extended"], re: /Applebot-Extended/i, key: "applebot-extended" },
  { agents: ["Bytespider"], re: /Bytespider/i, key: "bytespider" },
  { agents: ["CCBot"], re: /CCBot/i, key: "ccbot" },
  { agents: ["Amazonbot"], re: /Amazonbot/i, key: "amazonbot" },
  { agents: ["cohere-ai"], re: /cohere-ai/i, key: "cohere" },
];

app.use("*", async (c, next) => {
  await next();
  try {
    const ua = c.req.header("user-agent") ?? "";
    if (!ua) return;
    const hit = AI_CRAWLERS.find((b) => b.re.test(ua));
    if (!hit) return;
    const path = new URL(c.req.url).pathname;
    if (path === "/styles.css" || path.startsWith("/favicon")) return;
    c.executionCtx.waitUntil(
      c.env.DB.prepare("INSERT INTO citation_hits (id, path, bot, user_agent) VALUES (?, ?, ?, ?)")
        .bind(crypto.randomUUID(), path, hit.key, ua.slice(0, 300))
        .run()
        .then(() => {}),
    );
  } catch {
    // tracking must never affect a public response
  }
});

// Operator-visibility. Every one of the ~20 renderPage() call sites across
// public/render/*.ts builds its own args without an isOperator flag — nav
// (layout.ts renderNav) never had a way to point back at /op/*, so once
// logged in, the only path into the operator console was already knowing
// to type the URL. Rather than thread isOperator through every render
// function's signature, this rewrites the rendered page in one place: when
// the session cookie resolves to the operator, splice a separate strip
// above the public nav. No-ops (and costs one extra html.includes check)
// on every anonymous request.
//
// This used to splice operator links directly INTO .nav-links, at the same
// visual weight as Record/Investigations/Watchlist/Method and reusing the
// public search box's class with ad hoc inline color overrides — the
// public nav and operator tools became indistinguishable, both structurally
// and visually. Operator tools now render in their own dim strip ABOVE
// <nav>; the public nav (.nav-links) is never touched. "How this works" is
// public, not an operator tool — it moved to the public footer instead of
// living here.
//
// The status badge answers "the record has no idea whether it's still
// doing anything" — extraction and the settle pipeline run in the
// background with zero UI signal otherwise. digest_jobs already tracks
// queued/running/completed with timestamps; this just reads it.
app.use("*", async (c, next) => {
  await next();
  if (!c.get("is_operator")) return;
  const res = c.res;
  if (!res || !(res.headers.get("content-type") ?? "").includes("text/html")) return;
  const html = await res.text();
  if (!html.includes('<nav class="nav">')) {
    c.res = new Response(html, { status: res.status, headers: res.headers });
    return;
  }
  // Named op-topbar, not op-strip — investigations.ts's library rendering
  // already owns .op-strip for an unrelated per-page bulk-extract card;
  // reusing the name would have collided two different components under
  // one class in the cascade.
  // "operator →" always renders, status data or not — the console needs
  // to be reachable from any page, not conditional on digest_jobs having
  // rows (a fresh/idle corpus with nothing ever queued yet still needs a
  // way in without knowing the URL by heart).
  const status = await renderWorkStatusBadge(c.env.DB).catch(() => null);
  const statusHtml = status
    ? `<span class="op-topbar-status${status.live ? " live" : ""}"><span class="op-topbar-dot"></span><span title="${status.title}">${status.text}</span></span>`
    : "";
  const opTopbar = `<div class="op-topbar"><div class="op-topbar-inner"><span class="op-topbar-tag">Operator</span><a href="/op/library">operator →</a>${statusHtml}<div class="op-topbar-right"><a href="/v1/admin/runtime">runtime</a><a href="/citations">citations</a><a href="/auth/logout">sign out</a></div></div></div>\n`;
  const injected = html.replace('<nav class="nav">', `${opTopbar}<nav class="nav">`);
  c.res = new Response(injected, { status: res.status, headers: res.headers });
});

interface WorkStatus {
  text: string;
  title: string;
  live: boolean;
}

async function renderWorkStatusBadge(db: D1Database): Promise<WorkStatus | null> {
  const userId = await resolveOperatorId(db);
  if (!userId) return null;
  const active = await one<{ n: number }>(
    db,
    "SELECT COUNT(*) AS n FROM digest_jobs WHERE user_id = ? AND status IN ('queued','running')",
    [userId],
  ).catch(() => null);
  const activeCount = active?.n ?? 0;
  if (activeCount > 0) {
    return {
      text: `working — ${activeCount} in progress`,
      title: "click to see what's running, per document",
      live: true,
    };
  }
  const last = await one<{ updated_at: string | null }>(
    db,
    "SELECT MAX(updated_at) AS updated_at FROM digest_jobs WHERE user_id = ?",
    [userId],
  ).catch(() => null);
  if (!last?.updated_at) return null;
  const ago = formatRelativeTime(last.updated_at);
  return {
    text: `idle — ${ago}`,
    title: "nothing queued or running right now — click for the full extraction log",
    live: false,
  };
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Favicon — a tight monogram in the accent color. The "canopticon." brand
// is the wordmark + a dot in the cool-blue accent; we lean on the dot.
// Served as SVG (vector, recolors well in dark/light) with an .ico
// fallback that the browser resolves to the same SVG via the alternate
// icon hint.
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#0c0d10"/>
  <text x="16" y="22" font-family="Geist,system-ui,sans-serif" font-weight="700" font-size="20" letter-spacing="-1.2" text-anchor="middle" fill="#eceef2">c</text>
  <circle cx="24.5" cy="22" r="1.9" fill="#5d8bc6"/>
</svg>`;

app.get("/favicon.svg", () => {
  return new Response(FAVICON_SVG, {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": "public, max-age=86400",
    },
  });
});

app.get("/favicon.ico", () => {
  return new Response(FAVICON_SVG, {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": "public, max-age=86400",
    },
  });
});

// Styles. Long cache; the hash query string busts on content change.
app.get("/styles.css", () => {
  return new Response(STYLES_CSS, {
    headers: {
      "content-type": "text/css; charset=utf-8",
      "cache-control": "public, max-age=31536000, immutable",
      "x-styles-hash": stylesHash(),
    },
  });
});

// robots.txt + sitemap.xml — the entire GEO strategy (12 Arrangement types
// per subject, all with their own schema.org markup) depends on crawlers
// being able to enumerate the site; before this, there was nothing to
// enumerate against. /op/* stays disallowed (Cloudflare Access gates it
// anyway, but no reason to advertise it to a crawler).
// Crawl access is a decision here, not an inherited default. The content is
// CC BY 4.0 and being read — by people and by answer engines — is the entire
// point, so every AI crawler we track is also explicitly invited.
//
// ⚠️ Cloudflare blocks AI crawlers by default on zones created after July
// 2025. This file says the opposite, and a file cannot overrule the edge:
// if "Block AI Bots" is on for the canopticon.com zone, these crawlers get a
// 403 before the Worker ever runs and every allow line below is decorative.
// Verify with: curl -A GPTBot https://canopticon.com/
app.get("/robots.txt", () => {
  const aiAgents = AI_CRAWLERS.flatMap((b) => b.agents).map((a) => `User-agent: ${a}`);
  return new Response(
    [
      "# canopticon.com",
      "# Everything published here is CC BY 4.0. Being cited is the point.",
      "",
      "User-agent: *",
      "Disallow: /op/",
      "Allow: /",
      "",
      "# AI crawlers — explicitly allowed, not merely un-blocked.",
      ...aiAgents,
      "Disallow: /op/",
      "Allow: /",
      "",
      "Sitemap: https://canopticon.com/sitemap.xml",
      "",
    ].join("\n"),
    {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    },
  );
});

// The sitemap enumerated `pages` (subject pages) and NOT `pieces` — which
// meant every uploaded research document and every essay, the entire actual
// publication, was invisible to search engines. Pieces come first now;
// subject pages follow only where a reading has actually been signed, since
// an unsigned subject page is scaffolding and thin pages are a ranking
// liability rather than a neutral one.
app.get("/sitemap.xml", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  const staticUrls = ["/", "/essays", "/research", "/answers", "/about", "/method"];
  let pageUrls: Array<{ loc: string; lastmod: string }> = [];
  if (userId) {
    const pieces = await listPublishedPieces(c.env.DB, userId).catch(() => []);
    pageUrls = pieces.map((p) => ({
      loc: `/p/${p.slug}`,
      lastmod: (p.updated_at || p.published_at || "").slice(0, 10),
    }));
    const rows = await all<{ slug: string; updated_at: string; signed_status: string }>(
      c.env.DB,
      `SELECT slug, updated_at, signed_status FROM pages
        WHERE user_id = ? AND signed_status = 'published'
        ORDER BY updated_at DESC LIMIT 5000`,
      [userId],
    ).catch(() => []);
    pageUrls.push(
      ...rows.map((r) => ({ loc: `/s/${r.slug}`, lastmod: r.updated_at.slice(0, 10) })),
    );
    // Published answers are real pages and belong in the sitemap. Proposed
    // ones are not listed here because they have no URL.
    const answers = await listPublishedQuestions(c.env.DB, userId).catch(() => []);
    pageUrls.push(
      ...answers.map((a) => ({ loc: `/answers/${a.slug}`, lastmod: a.updated_at.slice(0, 10) })),
    );
  }
  const urlEntries = [...staticUrls.map((loc) => ({ loc, lastmod: "" })), ...pageUrls]
    .map(
      (u) =>
        `  <url><loc>https://canopticon.com${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`,
    )
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>\n`;
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
});

// `/` — one URL, one page. The operator browses the publication; the
// graph grows from what they DO on it (drop documents in the Library,
// sign readings from the subject page, expand thin Records on click).
// There is no separate OUT dashboard. Logged-in viewers get operator
// affordances WOVEN INTO this same page (system briefing, drafts
// awaiting signature, findings strip, open threads) — not a parallel
// dashboard. Spec v2.5 Part 9 retired the separate console; the OUT
// surface was IN/OUT scaffolding that survived the rename and is
// now gone too.
app.get("/", async (c) => htmlResponse(await renderFront(c.env)));

// ---- The two doors --------------------------------------------------------
//
// Essays and Research are the publication. Everything else below this point
// is either a supporting surface (a document page, a quote receipt, a
// timeline) or a route kept alive so existing links don't 404 — see the
// "unlinked but alive" block further down.

app.get("/essays", async (c) => htmlResponse(await renderEssaysIndex(c.env)));

// Answers — one page per question, shared across every document that answers
// it. A question the gate has not passed has no page at all; it returns 404
// rather than publishing something thin at a real URL.
app.get("/answers", async (c) => htmlResponse(await renderAnswersIndex(c.env)));
app.get("/answers/:slug", async (c) => {
  const html = await renderAnswerPage(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});
app.get("/research", async (c) => htmlResponse(await renderResearchIndex(c.env)));

// ---- Topics ---------------------------------------------------------------

app.get("/topics", async (c) => htmlResponse(await renderTopicsIndex(c.env)));

// Watchlist — the public surface for coverage_beats (previously only
// reachable as the operator via /v1/admin/beats). Not "/monitors" —
// graph/routes/monitors.ts is a separate, older, unrelated system.
app.get("/watchlist", async (c) =>
  htmlResponse(await renderWatchlistPage(c.env, { isOperator: c.get("is_operator") })),
);

// ---- Videos ----------------------------------------------------------
// Published video essays — reading-sourced (from a signed File's
// "Produce video essay" action) and the daily GDELT news-clip radar,
// both surfaced from the separate video Worker's public API. See
// render/videos.ts.
app.get("/videos", async (c) => htmlResponse(await renderVideosPage(c.env)));
app.get("/activity", async (c) => htmlResponse(await renderActivityPage(c.env)));

// ---- Instruments ----------------------------------------------------------
// The third product arm's doorway. Instruments live on their own
// subdomains; this page is the machine-citable index into them.
app.get("/instruments", () => htmlResponse(renderInstrumentsIndex()));

app.get("/topics/:slug", async (c) => {
  const html = await renderTopicHub(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// ---- Investigations -------------------------------------------------------

app.get("/investigations", async (c) =>
  htmlResponse(await renderInvestigationsIndex(c.env, c.req.query("intent"))),
);

app.get("/investigations/:slug", async (c) => {
  const html = await renderPiece(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// Universal piece page — any kind, as long as it's published or canonical.
// Editor and Publish screens link here; treat as the canonical short URL
// for a piece. Working-material stays private.
//
// IMPORTANT: this route ALSO tries to resolve the slug as a SUBJECT PAGE
// (entity / event / theme — the unified fabric). The reader doesn't know
// which they're clicking into; the renderer figures it out. Pieces win on
// slug collision (they were the original /p/ tenant); subject pages fall
// back to a /s/ alias below for unambiguous links.
app.get("/p/:slug", async (c) => {
  const raw = c.req.param("slug");
  // The markdown twin is handled here rather than on its own `/p/:slug.md`
  // route. It HAD its own route, registered after this one — so every
  // request for a twin matched `/p/:slug` with the ".md" still attached,
  // found no piece by that slug, and 404'd. The endpoint had never worked.
  // Folding it in means route order can't shadow it again.
  if (raw.endsWith(".md")) {
    const mdSlug = raw.slice(0, -3);
    const userId = await resolveOperatorId(c.env.DB);
    let piece = userId ? await getPieceBySlug(c.env.DB, userId, mdSlug) : null;
    if (!piece && userId) {
      // The twin follows retired slugs too. Missing this would leave every
      // `.md` citation of a renamed document dead while its HTML kept working
      // — the machine-readable half broken and nothing to show for it.
      const { one: oneRow } = await import("../lib/d1");
      const alias = await oneRow<{ slug: string }>(
        c.env.DB,
        `SELECT p.slug FROM piece_slug_aliases a JOIN pieces p ON p.id = a.piece_id
          WHERE a.user_id = ? AND a.old_slug = ?`,
        [userId, mdSlug],
      ).catch(() => null);
      if (alias?.slug) piece = await getPieceBySlug(c.env.DB, userId, alias.slug);
    }
    if (!piece || piece.publication_status === "working-material") {
      return htmlResponse(renderNotFound(c.req.path), { status: 404 });
    }
    return new Response(pieceMarkdown(piece), {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    });
  }
  const slug = raw;
  // Try the piece renderer first (original semantics).
  const html = await renderPiece(c.env, slug);
  if (html) return htmlResponse(html);

  // A retired slug. Every document published before migration 0052 had a
  // filename-with-a-UUID for a URL; /v1/admin/reslug renamed them and banked
  // the old slug here. A citation already in the world must keep resolving —
  // a 404 is worse than the ugly URL it replaced — so this 301s to the
  // current one rather than falling through to the not-found page.
  const aliasUser = await resolveOperatorId(c.env.DB);
  if (aliasUser) {
    const { one: oneRow } = await import("../lib/d1");
    const alias = await oneRow<{ slug: string }>(
      c.env.DB,
      `SELECT p.slug FROM piece_slug_aliases a JOIN pieces p ON p.id = a.piece_id
        WHERE a.user_id = ? AND a.old_slug = ?`,
      [aliasUser, slug],
    ).catch(() => null);
    if (alias?.slug && alias.slug !== slug) return c.redirect(`/p/${alias.slug}`, 301);
  }
  // Fall through to subject pages. mode=signed reveals the operator's reading.
  const { renderSubjectPage } = await import("./render/subject-page");
  const mode = c.req.query("mode") === "signed" ? "signed" : "neutral";
  const subject = await renderSubjectPage(c.env, slug, mode, {
    isOperator: c.get("is_operator"),
    expanding: c.req.query("expanding") === "1",
    videoMsg: c.req.query("video_msg"),
    draftMsg: c.req.query("draft_msg"),
    proposalMsg: c.req.query("proposal_msg"),
  });
  if (subject) return htmlResponse(subject);
  return htmlResponse(renderNotFound(c.req.path), { status: 404 });
});

// /s/:slug — unambiguous subject-page alias (entity / event / theme). Used in
// internal links where we know the target is a subject, not a piece.
app.get("/s/:slug", async (c) => {
  const { renderSubjectPage } = await import("./render/subject-page");
  const mode = c.req.query("mode") === "signed" ? "signed" : "neutral";
  const html = await renderSubjectPage(c.env, c.req.param("slug"), mode, {
    isOperator: c.get("is_operator"),
    expanding: c.req.query("expanding") === "1",
    videoMsg: c.req.query("video_msg"),
    draftMsg: c.req.query("draft_msg"),
    proposalMsg: c.req.query("proposal_msg"),
  });
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// Clean-markdown download — the "source of record" button on every
// piece page links here. Returns the raw body_md with a Content-Disposition
// that triggers a download in browsers.
// ---- mailing list ---------------------------------------------------------
//
// A plain form POST, because the site's no-JS contract applies here too. The
// existing JSON endpoint (v1/public/subscribe) stays for programmatic use;
// this is the one a person's browser submits.
//
// No sending infrastructure exists yet. That is deliberate — addresses are
// worth collecting now, a campaign system is not worth building now — and the
// confirmation page says as much rather than implying a welcome email is on
// its way.

const EMAIL_RE = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

app.post("/subscribe", async (c) => {
  const form = await c.req.parseBody();
  const email = String(form.email ?? "")
    .trim()
    .toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return htmlResponse(renderSubscribeError("That doesn't look like an email address."), {
      status: 400,
    });
  }
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) {
    return htmlResponse(renderSubscribeError("The mailing list isn't accepting sign-ups yet."), {
      status: 503,
    });
  }
  // The table's UNIQUE (email, thesis_id) does not catch repeats here: SQLite
  // treats NULLs as distinct, and thesis_id is NULL for a plain site-wide
  // subscription. So the duplicate check is explicit.
  const existing = await one<{ id: string }>(
    c.env.DB,
    "SELECT id FROM pub_subscriptions WHERE email = ? AND thesis_id IS NULL AND unsubscribed_at IS NULL",
    [email],
  ).catch(() => null);
  if (existing) return htmlResponse(renderSubscribed(true));

  await c.env.DB.prepare(
    `INSERT INTO pub_subscriptions (id, user_id, email, channels, unsubscribe_token, confirmation_token)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      userId,
      email,
      JSON.stringify(["articles"]),
      crypto.randomUUID(),
      crypto.randomUUID(),
    )
    .run();
  return htmlResponse(renderSubscribed(false));
});

app.get("/unsubscribe", async (c) => {
  const token = c.req.query("token") ?? "";
  if (!token) return htmlResponse(renderUnsubscribed(false), { status: 400 });
  const row = await one<{ id: string }>(
    c.env.DB,
    "SELECT id FROM pub_subscriptions WHERE unsubscribe_token = ? AND unsubscribed_at IS NULL",
    [token],
  ).catch(() => null);
  if (!row) return htmlResponse(renderUnsubscribed(false), { status: 404 });
  await c.env.DB.prepare("UPDATE pub_subscriptions SET unsubscribed_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), row.id)
    .run();
  return htmlResponse(renderUnsubscribed(true));
});

app.get("/confirm", async (c) => {
  const token = c.req.query("token") ?? "";
  if (!token) return htmlResponse(renderConfirmed(false), { status: 400 });
  const row = await one<{ id: string }>(
    c.env.DB,
    "SELECT id FROM pub_subscriptions WHERE confirmation_token = ? AND unsubscribed_at IS NULL",
    [token],
  ).catch(() => null);
  if (!row) return htmlResponse(renderConfirmed(false), { status: 404 });
  await c.env.DB.prepare(
    "UPDATE pub_subscriptions SET confirmed = 1, confirmation_token = NULL WHERE id = ?",
  )
    .bind(row.id)
    .run();
  return htmlResponse(renderConfirmed(true));
});

// ---- the machine face -----------------------------------------------------
//
// llms.txt and feed.json are generated from the same listPublishedPieces()
// query the sitemap uses, so the three can never disagree about what exists.

app.get("/llms.txt", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  const pieces = userId ? await listPublishedPieces(c.env.DB, userId).catch(() => []) : [];
  const answers = userId ? await listPublishedQuestions(c.env.DB, userId).catch(() => []) : [];
  return new Response(llmsTxt(pieces, answers), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
});

app.get("/feed.json", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  const pieces = userId ? await listPublishedPieces(c.env.DB, userId).catch(() => []) : [];
  return new Response(feedJson(pieces), {
    headers: {
      "content-type": "application/feed+json; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
});

// Library piece page — same renderer.
app.get("/library/:slug", async (c) => {
  const html = await renderPiece(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// /q/:id — the verbatim quote receipt. Deep-linkable citation for every
// superscript in the publication. Schema.org Quotation JSON-LD so AI
// answer engines can cite the exact quote with attribution.
app.get("/q/:id", async (c) => {
  const { renderQuoteReceipt } = await import("./render/quote-receipt");
  const html = await renderQuoteReceipt(c.env, c.req.param("id"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// ---- Arrangements as standalone renderings (spec v2.6 Part 6) -----------
// Each arrangement is BOTH a section embedded inside a subject page AND a
// standalone addressable page with its own URL + JSON-LD — deliberately,
// for GEO: a fine-grained citable URL with specific schema.org markup
// out-cites a subject page that merely has the same content as one
// section. These are NOT meant to be reached by internal site nav — Part
// 13 is explicit that they "don't appear in nav — they're reached through
// the subject page they belong to, through search, and through
// citations." All twelve were restored here after an earlier cleanup pass
// wrongly read "no internal nav link" as "dead code" for 7 of them; the
// real, still-open bug is that subject-page.ts only ever wired "see
// standalone →" embed links for 4 of the 12 (t/profile/n/ct below) — see
// the fix alongside this restore for the other 8.
//
// `/d/:slug` — Definition (DefinedTerm JSON-LD).
app.get("/d/:slug", async (c) => {
  const { renderDefinitionPage } = await import("./render/arrangements/definition");
  const html = await renderDefinitionPage(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// `/t/:slug` — Timeline (ItemList + Event JSON-LD)
app.get("/t/:slug", async (c) => {
  const { renderTimelinePage } = await import("./render/arrangements/timeline");
  const html = await renderTimelinePage(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// `/profile/:slug` — Entity / Actor profile (Person | Organization | Event |
// CreativeWork JSON-LD per subject kind). Word-form prefix avoids the
// collision with the legacy `/p/:slug` piece-fallback route.
app.get("/profile/:slug", async (c) => {
  const { renderProfilePage } = await import("./render/arrangements/profile");
  const html = await renderProfilePage(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// `/n/:slug` — Ownership / network map (OwnershipInfo JSON-LD).
app.get("/n/:slug", async (c) => {
  const { renderNetworkPage } = await import("./render/arrangements/network");
  const html = await renderNetworkPage(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// `/pr/:slug` — standalone Proposal page (fabric redesign Phase 7, the
// third fabric layer: prescriptive, keyed by page_proposals.slug, not a
// subject's own pages.slug — many proposals can exist per subject).
app.get("/pr/:slug", async (c) => {
  const { renderProposalPage } = await import("./render/arrangements/proposal");
  const html = await renderProposalPage(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// `/w/:slug` — Who's-who roster (ItemList of Person JSON-LD).
app.get("/w/:slug", async (c) => {
  const { renderWhosWhoPage } = await import("./render/arrangements/whos-who");
  const html = await renderWhosWhoPage(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// `/b/:slug` — Bibliography / body-of-work (ItemList of CreativeWork JSON-LD).
app.get("/b/:slug", async (c) => {
  const { renderBibliographyPage } = await import("./render/arrangements/bibliography");
  const html = await renderBibliographyPage(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// `/c/:slug` — Comparison matrix (Table + ClaimReview JSON-LD). Scaffold
// rendering only — the graph isn't yet tagged with comparison-shaped data,
// so this currently always renders its honest empty state. Real query
// logic is still an open build item, not something this restore fixes.
app.get("/c/:slug", async (c) => {
  const { renderComparisonPage } = await import("./render/arrangements/comparison");
  const html = await renderComparisonPage(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// `/f/:slug` — FAQ / Q&A hub (FAQPage JSON-LD).
app.get("/f/:slug", async (c) => {
  const { renderFaqPage } = await import("./render/arrangements/faq");
  const html = await renderFaqPage(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// `/stat/:slug` — Statistics roundup (Dataset JSON-LD).
app.get("/stat/:slug", async (c) => {
  const { renderStatsPage } = await import("./render/arrangements/stats");
  const html = await renderStatsPage(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// `/l/:slug` — Ledger of flows (Dataset + MonetaryAmount JSON-LD).
app.get("/l/:slug", async (c) => {
  const { renderLedgerPage } = await import("./render/arrangements/ledger");
  const html = await renderLedgerPage(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// `/m/:slug` — Mechanism explainer (HowTo / Article JSON-LD).
app.get("/m/:slug", async (c) => {
  const { renderMechanismPage } = await import("./render/arrangements/mechanism");
  const html = await renderMechanismPage(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// `/ct/:slug` — Claim-and-source table (Claim + ClaimReview JSON-LD).
app.get("/ct/:slug", async (c) => {
  const { renderClaimTablePage } = await import("./render/arrangements/claim-table");
  const html = await renderClaimTablePage(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// `/doc/:slug` — Document-of-record. This IS the source document; the
// existing /library/:slug renderer already serves it with the receipt-loop
// section ("this document fed the fabric"). Alias the URL so the v2.6
// arrangement table is complete and external citations resolve.
app.get("/doc/:slug", (c) => c.redirect(`/library/${c.req.param("slug")}`, 301));

// ---- The Record -----------------------------------------------------------

// Part 18: "The Record" dissolves as a destination — the index redirects to
// Topics (the one browsable doorway). Entity DETAIL pages stay addressable
// below as unmarked factual substrate.
// Home IS the front of the Record.
app.get("/record", (c) => c.redirect("/", 301));

app.get("/record/:slug", async (c) => {
  const html = await renderEntityPage(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// ---- Patterns (the lighthouse) --------------------------------------------
// The old flat-SQL "lighthouse" system (patterns/gaps/timeline as content,
// distinct from the live `patterns` table that still feeds Home's "Worth
// your eye" panel). Fully superseded by the typed graph's equivalents
// (themes, /t/:slug). The detail page and its two sibling indexes had zero
// inbound links anywhere on the site — removed as dead weight; the
// underlying tables are untouched.
//
// Part 18: "Patterns" dissolves as a destination — pattern pieces surface
// inside Investigations (intent badges).
app.get("/patterns", (c) => c.redirect("/investigations", 301));

// ---- Library --------------------------------------------------------------

// /library is now the OPERATOR's working surface, not a public door: it
// lists working-material alongside published pieces and carries the upload
// dropzone. A logged-out visitor asking for it wants the published research,
// so send them there rather than showing them a second, messier copy of it.
app.get("/library", async (c) => {
  if (!c.get("is_operator")) return c.redirect("/research", 301);
  const ingested = c.req.query("ingested");
  const error = c.req.query("error");
  const importing = c.req.query("importing");
  const videoError = c.req.query("video_error");
  const draining = c.req.query("draining");
  const atoms = c.req.query("atoms");
  const atomsModel = c.req.query("model");
  const published = c.req.query("published");
  return htmlResponse(
    await renderLibraryIndex(c.env, {
      isOperator: c.get("is_operator"),
      ...(ingested ? { ingested } : {}),
      ...(error ? { error } : {}),
      ...(importing ? { importing } : {}),
      ...(videoError ? { videoError } : {}),
      ...(draining ? { draining } : {}),
      ...(atoms ? { atoms } : {}),
      ...(atomsModel ? { model: atomsModel } : {}),
      ...(published ? { published } : {}),
    }),
  );
});

// ---- Briefs (the third projection) -------------------------------------
//
// A published Brief renders here as a server-rendered citable page.
// The trust boundary is mechanical (verbatim-substring + independent
// judge) not "the operator vouched for it". See briefs/pipeline.ts.
app.get("/briefs/:slug", async (c) => {
  const html = await renderBriefPage(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// ---- Utility pages (still placeholders until trailing Phase 2) -----------

// About is a real page again. It used to 301 to /method, which left the site
// with a page on how verification works and none on what the site is — the
// first thing both a reader and an answer engine want to know.
app.get("/about", () => htmlResponse(renderAbout()));

// Method — how verification works, in plain words. Linked from /about.
app.get("/method", () => htmlResponse(renderMethodology()));

app.get("/methodology", (c) => c.redirect("/method", 301));

// How this works — the operator orientation page: what runs on its own
// between visits, what each operator action does. Public (nothing
// sensitive), written for the operator.
app.get("/how-it-works", async (c) => {
  const { renderHowItWorks } = await import("./render/how-it-works");
  return htmlResponse(await renderHowItWorks(c.env));
});

// /sources was a placeholder stub that never got built — /library already
// does everything it was meant to (a real index, per-document extraction
// stats). Redirect instead of building a second one.
app.get("/sources", (c) => c.redirect("/library", 301));

// Search — semantic search over the corpus (v2.6 Part 18 #6). Uses the
// existing Vectorize index that already holds entity / claim / piece /
// thesis / source embeddings. Public; results are read-only.
app.get("/search", async (c) => {
  const q = c.req.query("q") ?? "";
  return htmlResponse(
    await renderSearchPage(c.env, q, {
      isOperator: c.get("is_operator"),
    }),
  );
});

// Bulk expand result — operator-only. The trigger is a POST at
// /op/records/bulk-expand (operator/routes.ts); this GET just shows what
// came of it. Anonymous viewers never see this (no link to it exists
// outside the operator overlay), but gate it directly anyway rather than
// relying on obscurity.
app.get("/bulk-expand", async (c) => {
  if (!c.get("is_operator")) return c.redirect("/");
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/");
  const subjectsParam = c.req.query("subjects") ?? "";
  const subjects = subjectsParam
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  const { renderBulkExpandEmpty, renderBulkExpandResult } = await import("./render/bulk-expand");
  if (subjects.length === 0) return htmlResponse(renderBulkExpandEmpty());
  return htmlResponse(await renderBulkExpandResult(c.env, userId, subjects));
});

// Studio Stage A — the Produce flow for static formats (v2.6 Part 27).
// Operator-only; routes redirect anonymous viewers home. Mounts at
// /studio/:slug/:kind for the preview page and
// /studio/:pageId/:kind/produce for the PNG download.
app.route("/studio", studioRoutes);

// Citations — operator-only view of AI-crawler hits on public pages
// (v2.6 Part 14 #10). The middleware at the top of this file already
// captures the hits into citation_hits; this surfaces them.
app.get("/citations", async (c) => {
  if (!c.var.is_operator) return c.redirect("/");
  return htmlResponse(await renderCitationsPage(c.env));
});

// 404 handling lives at the parent (Worker) level so /v1/* misses can
// return JSON while /* misses get the styled HTML page. See index.ts.

export default app;
export { renderNotFound };
