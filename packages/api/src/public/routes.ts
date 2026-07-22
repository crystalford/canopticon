// Public site routes. Server-rendered HTML, no JS required to read.
// Mounted at `/` in the Worker root (packages/api/src/index.ts).
//
// Phase 2: the five primary destinations read live from D1. Detail
// pages (topic hub, piece, entity) fall through to the styled 404 when
// the slug doesn't resolve. Empty D1 renders graceful empty states —
// the surfaces work before the seed corpus lands.

import { Hono } from "hono";
import type { AuthContext } from "../auth/middleware";
import { one } from "../lib/d1";
import { getPieceBySlug, resolveOperatorId } from "./data";
import { htmlResponse } from "./layout";
import { renderBriefPage } from "./render/brief";
import { renderCitationsPage } from "./render/citations";
import { renderHome } from "./render/home";
import { renderInstrumentsIndex } from "./render/instruments";
import { renderInvestigationsIndex, renderLibraryIndex } from "./render/investigations";
import { renderMethodology } from "./render/methodology";
import { renderPiece } from "./render/piece-template";
import { renderNotFound, renderPlaceholder } from "./render/placeholder";
import { renderEntityPage } from "./render/record";
import { renderSearchPage } from "./render/search";
import { renderTopicHub, renderTopicsIndex } from "./render/topics";
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
const AI_BOTS: Array<[RegExp, string]> = [
  [/GPTBot/i, "gptbot"],
  [/OAI-SearchBot/i, "oai-search"],
  [/ChatGPT-User/i, "chatgpt-user"],
  [/ClaudeBot|Claude-Web|anthropic-ai/i, "claudebot"],
  [/PerplexityBot/i, "perplexity"],
  [/Google-Extended/i, "google-extended"],
  [/Bytespider/i, "bytespider"],
  [/CCBot/i, "ccbot"],
  [/Amazonbot/i, "amazonbot"],
  [/cohere-ai/i, "cohere"],
];

app.use("*", async (c, next) => {
  await next();
  try {
    const ua = c.req.header("user-agent") ?? "";
    if (!ua) return;
    const hit = AI_BOTS.find(([re]) => re.test(ua));
    if (!hit) return;
    const path = new URL(c.req.url).pathname;
    if (path === "/styles.css" || path.startsWith("/favicon")) return;
    c.executionCtx.waitUntil(
      c.env.DB.prepare("INSERT INTO citation_hits (id, path, bot, user_agent) VALUES (?, ?, ?, ?)")
        .bind(crypto.randomUUID(), path, hit[1], ua.slice(0, 300))
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
// function's signature, this rewrites the rendered nav in one place: when
// the session cookie resolves to the operator, splice an "operator" link
// in ahead of the search affordance. No-ops (and costs one extra
// html.includes check) on every anonymous request.
//
// Same pass also splices in a live work-status badge — "the record has no
// idea whether it's still doing anything" was a direct complaint: extraction
// and the settle pipeline all run in the background with zero UI signal, so
// the only way to tell was asking me to query the admin API by hand all
// session. digest_jobs already tracks queued/running/completed with
// timestamps; this just reads it. Operator-only, same reasoning as the nav
// link — this is operational state, not editorial content for readers.
app.use("*", async (c, next) => {
  await next();
  if (!c.get("is_operator")) return;
  const res = c.res;
  if (!res || !(res.headers.get("content-type") ?? "").includes("text/html")) return;
  const html = await res.text();
  if (!html.includes('class="nav-search"')) {
    c.res = new Response(html, { status: res.status, headers: res.headers });
    return;
  }
  const statusBadge = await renderWorkStatusBadge(c.env.DB).catch(() => "");
  const injected = html.replace(
    '<a href="/search" class="nav-search">',
    `${statusBadge}<a href="/op/library" class="nav-search" style="color:var(--accent,#5d8bc6)">operator →</a>\n      <a href="/search" class="nav-search">`,
  );
  c.res = new Response(injected, { status: res.status, headers: res.headers });
});

async function renderWorkStatusBadge(db: D1Database): Promise<string> {
  const userId = await resolveOperatorId(db);
  if (!userId) return "";
  const active = await one<{ n: number }>(
    db,
    "SELECT COUNT(*) AS n FROM digest_jobs WHERE user_id = ? AND status IN ('queued','running')",
    [userId],
  ).catch(() => null);
  const activeCount = active?.n ?? 0;
  if (activeCount > 0) {
    return `<span class="nav-search" style="color:var(--accent,#5d8bc6)" title="digest jobs currently queued or running">⟳ working — ${activeCount} in progress</span>\n      `;
  }
  const last = await one<{ updated_at: string | null }>(
    db,
    "SELECT MAX(updated_at) AS updated_at FROM digest_jobs WHERE user_id = ?",
    [userId],
  ).catch(() => null);
  if (!last?.updated_at) return "";
  const ago = formatRelativeTime(last.updated_at);
  return `<span class="nav-search" style="color:var(--ink-mute,#666873)" title="nothing queued or running right now">idle — ${ago}</span>\n      `;
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

// Favicon — a tight monogram in the amber accent. The "canopticon." brand
// is the wordmark + a dot in --amber; we lean on the dot. Served as SVG
// (vector, recolors well in dark/light) with an .ico fallback that the
// browser resolves to the same SVG via the alternate icon hint.
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#0c0d10"/>
  <text x="16" y="22" font-family="Geist,system-ui,sans-serif" font-weight="700" font-size="20" letter-spacing="-1.2" text-anchor="middle" fill="#eceef2">c</text>
  <circle cx="24.5" cy="22" r="1.9" fill="#e09a3a"/>
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

// `/` — one URL, one page. The operator browses the publication; the
// graph grows from what they DO on it (drop documents in the Library,
// sign readings from the subject page, expand thin Records on click).
// There is no separate OUT dashboard. Logged-in viewers get operator
// affordances WOVEN INTO this same page (system briefing, drafts
// awaiting signature, findings strip, open threads) — not a parallel
// dashboard. Spec v2.5 Part 9 retired the separate console; the OUT
// surface was IN/OUT scaffolding that survived the rename and is
// now gone too.
app.get("/", async (c) =>
  htmlResponse(await renderHome(c.env, { isOperator: c.get("is_operator") })),
);

// ---- Topics ---------------------------------------------------------------

app.get("/topics", async (c) => htmlResponse(await renderTopicsIndex(c.env)));

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
  const slug = c.req.param("slug");
  // Try the piece renderer first (original semantics).
  const html = await renderPiece(c.env, slug);
  if (html) return htmlResponse(html);
  // Fall through to subject pages. mode=signed reveals the operator's reading.
  const { renderSubjectPage } = await import("./render/subject-page");
  const mode = c.req.query("mode") === "signed" ? "signed" : "neutral";
  const subject = await renderSubjectPage(c.env, slug, mode, {
    isOperator: c.get("is_operator"),
    expanding: c.req.query("expanding") === "1",
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
  });
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// Clean-markdown download — the "source of record" button on every
// piece page links here. Returns the raw body_md with a Content-Disposition
// that triggers a download in browsers.
app.get("/p/:slug.md", async (c) => {
  const slug = (c.req.param("slug") ?? "").replace(/\.md$/, "");
  if (!slug) return c.notFound();
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.notFound();
  const piece = await getPieceBySlug(c.env.DB, userId, slug);
  if (!piece || piece.publication_status === "working-material") return c.notFound();
  return new Response(piece.body_md ?? "", {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${slug}.md"`,
      "cache-control": "public, max-age=300",
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
// standalone addressable page with its own URL + JSON-LD. Pure rendering:
// template + query, no LLM at render time.
//
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

// `/n/:slug` — Network map (ItemList of Role JSON-LD).
app.get("/n/:slug", async (c) => {
  const { renderNetworkPage } = await import("./render/arrangements/network");
  const html = await renderNetworkPage(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// `/stat/:slug` — Statistics roundup (Dataset + PropertyValue JSON-LD).
app.get("/stat/:slug", async (c) => {
  const { renderStatsPage } = await import("./render/arrangements/stats");
  const html = await renderStatsPage(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// `/ct/:slug` — Claim-and-source table (ClaimReview per row).
app.get("/ct/:slug", async (c) => {
  const { renderClaimTablePage } = await import("./render/arrangements/claim-table");
  const html = await renderClaimTablePage(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// `/d/:slug` — Definition (DefinedTerm JSON-LD).
app.get("/d/:slug", async (c) => {
  const { renderDefinitionPage } = await import("./render/arrangements/definition");
  const html = await renderDefinitionPage(c.env, c.req.param("slug"));
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

// `/m/:slug` — Mechanism explainer (HowTo + HowToStep JSON-LD).
app.get("/m/:slug", async (c) => {
  const { renderMechanismPage } = await import("./render/arrangements/mechanism");
  const html = await renderMechanismPage(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// `/f/:slug` — FAQ / Q&A hub (FAQPage + Question + Answer JSON-LD).
app.get("/f/:slug", async (c) => {
  const { renderFaqPage } = await import("./render/arrangements/faq");
  const html = await renderFaqPage(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// `/c/:slug` — Comparison matrix (Table JSON-LD; scaffold rendering).
app.get("/c/:slug", async (c) => {
  const { renderComparisonPage } = await import("./render/arrangements/comparison");
  const html = await renderComparisonPage(c.env, c.req.param("slug"));
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

// ---- Patterns / gaps / timeline (the lighthouse) -------------------------

// Part 18: "Patterns" dissolves as a destination — pattern pieces surface
// inside Investigations (intent badges). Detail pages stay addressable.
app.get("/patterns", (c) => c.redirect("/investigations", 301));

app.get("/patterns/:slug", async (c) => {
  const { renderPatternDetail } = await import("./render/pattern-detail");
  const html = await renderPatternDetail(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

app.get("/gaps", async (c) => {
  const { renderGapsIndex } = await import("./render/gaps");
  return htmlResponse(await renderGapsIndex(c.env));
});

app.get("/timeline", async (c) => {
  const { renderTimelineIndex } = await import("./render/timeline");
  return htmlResponse(await renderTimelineIndex(c.env));
});

// ---- Library --------------------------------------------------------------

app.get("/library", async (c) => {
  const ingested = c.req.query("ingested");
  const error = c.req.query("error");
  return htmlResponse(
    await renderLibraryIndex(c.env, {
      isOperator: c.get("is_operator"),
      ...(ingested ? { ingested } : {}),
      ...(error ? { error } : {}),
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

// Method — how verification works, in plain words. Absorbs About.
app.get("/method", () => htmlResponse(renderMethodology()));
app.get("/about", (c) => c.redirect("/method", 301));

app.get("/methodology", (c) => c.redirect("/method", 301));

app.get("/sources", () =>
  htmlResponse(
    renderPlaceholder({
      title: "Sources",
      description: "Every external document the claims rest on.",
      activeNav: "/sources",
      whatsHere: "Sources index lands alongside the record's claim footprints.",
    }),
  ),
);

// Search — semantic search over the corpus (v2.6 Part 18 #6). Uses the
// existing Vectorize index that already holds entity / claim / piece /
// thesis / source embeddings. Public; results are read-only.
app.get("/search", async (c) => {
  const q = c.req.query("q") ?? "";
  return htmlResponse(
    await renderSearchPage(c.env, q, {
      isOperator: c.get("is_operator"),
      researching: c.req.query("researching") === "1",
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
