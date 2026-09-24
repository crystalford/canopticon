// Public site routes. Server-rendered HTML, no JS required to read.
// Mounted at `/` in the Worker root (packages/api/src/index.ts).
//
// Phase 2: the five primary destinations read live from D1. Detail
// pages (topic hub, piece, entity) fall through to the styled 404 when
// the slug doesn't resolve. Empty D1 renders graceful empty states —
// the surfaces work before the seed corpus lands.

import { Hono } from "hono";
import type { AuthContext } from "../auth/middleware";
import { TOPICS } from "../graph/lib/topics";
import { one } from "../lib/d1";
import { indexNowKey } from "../lib/indexnow";
import {
  getPieceBySlug,
  listPublishedPieces,
  listPublishedPiecesFull,
  listResearch,
  resolveOperatorId,
  topicSlug,
} from "./data";
import { htmlResponse } from "./layout";
import { feedJson, llmsFullTxt, llmsTxt, pieceMarkdown } from "./machine";
import { documentModel } from "./models/document";
import { emptyLibraryModel, libraryModel } from "./models/library";
import { searchModel } from "./models/search";
import { renderAbout } from "./render/about";
import { renderCitationsPage } from "./render/citations";
import { renderFront } from "./render/front";
import { renderEssaysIndex, renderResearchIndex, renderSectionHub } from "./render/indexes";
import { renderLibraryIndex } from "./render/investigations";
import { renderMethodology } from "./render/methodology";
import { renderPiece } from "./render/piece-template";
import { renderNotFound } from "./render/placeholder";
import { renderSearchPage } from "./render/search";
import {
  renderConfirmed,
  renderSignedOut,
  renderSubscribeError,
  renderSubscribed,
  renderUnsubscribed,
} from "./render/subscribe";
import { STYLES_CSS, stylesHash } from "./styles";

// The public site reads is_operator / operator_id from the Hono context
// (set by attachAuthState in index.ts) so renderers can reveal logged-in
// affordances on the SAME URLs that serve anonymous readers. AuthContext
// happens to carry the same shape; we don't enforce its email/user_id
// fields here — those are only set by the hard-auth path on /v1/* routes.
const app = new Hono<AuthContext>();

// A retired subject-shaped URL ("/s/mark-carney") lands on search for the
// subject, which is the one live surface that can still answer for it.
function searchFor(slug: string): string {
  return `/search?q=${encodeURIComponent(slug.replace(/[-_]+/g, " ").trim())}`;
}

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
// Cloudflare Web Analytics, on every public HTML page, only when the token
// is set. Free, cookie-free, and optional: the page reads without it (rule 7).
app.use("*", async (c, next) => {
  await next();
  const token = c.env.CF_WEB_ANALYTICS_TOKEN;
  if (!token) return;
  const res = c.res;
  if (!res || !(res.headers.get("content-type") ?? "").includes("text/html")) return;
  const html = await res.text();
  const { renderAnalyticsBeacon } = await import("./layout");
  const out = html.includes("</body>")
    ? html.replace("</body>", `${renderAnalyticsBeacon(token)}</body>`)
    : html;
  c.res = new Response(out, { status: res.status, headers: res.headers });
});

// The share card the pipeline drew for a document (graph/lib/og-image.ts),
// stored in R2 at og/<slug>.png. A document without one 404s here and its
// page simply carries no og:image.
app.get("/og/:file", async (c) => {
  const file = c.req.param("file");
  // One flat name under og/: the pipeline writes og/<slug>.png and a slug
  // is [a-z0-9-]. Anything else (an encoded "/", a "..") never reaches R2.
  if (!/^[A-Za-z0-9_-]+\.png$/.test(file)) return c.notFound();
  const obj = await c.env.FILES.get(`og/${file}`).catch(() => null);
  if (!obj) return c.notFound();
  return new Response(obj.body, {
    headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" },
  });
});

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
  // ONE nav. The operator used to get a second bar above the public nav (an
  // "OPERATOR" strip with runtime · citations · sign out) AND a Library link
  // injected before the nav's inner container — which rendered as a stray
  // "• Library" line between the two. Three tiers on every page, and the
  // operator said it looked bolted together. It was. Now the signed-in nav
  // is the reader's nav plus: Library first, and on the right a small
  // working indicator and sign out. Same bar, same height, same rules.
  const status = await renderWorkStatusBadge(c.env.DB).catch(() => null);
  const statusHtml = status
    ? `<a href="/library" class="nav-op-status${status.live ? " live" : ""}" title="${status.title}"><span class="nav-op-dot"></span>${status.text}</a>`
    : "";
  const withNav = html
    .replace(
      '<div class="nav-links">\n      ',
      '<div class="nav-links">\n      <a href="/library" class="nav-op">Library</a>\n      ',
    )
    .replace(
      '<a href="/search" class="nav-search"><span class="q">/</span> Search</a>',
      `<a href="/search" class="nav-search"><span class="q">/</span> Search</a>${statusHtml}<a href="/auth/logout" class="nav-op-out">Sign out</a>`,
    );
  c.res = new Response(withNav, { status: res.status, headers: res.headers });
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
  // No idle badge. It read "idle — 54d ago" on the live site: a timestamp of
  // the last typed-graph digestion, which is one of several pipelines and not
  // the one the operator had just run. True, internal, and alarming — the
  // same measure-the-internals pattern the front page's state strip and the
  // library's number band were removed for. When nothing is running, the bar
  // says nothing; when something is, it says so.
  return null;
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
  // Empty indexes are NOT announced. layout.ts says it plainly about the nav —
  // "thin pages are a ranking liability rather than a neutral one" — and a
  // sitemap entry is the same promise made to a crawler. /numbers joins this
  // list below, once it actually has rows.
  const staticUrls = ["/", "/essays", "/research", "/search", "/about", "/method"];
  let pageUrls: Array<{ loc: string; lastmod: string }> = [];
  let hubUrls: Array<{ loc: string; lastmod: string }> = [];
  if (userId) {
    const pieces = await listPublishedPieces(c.env.DB, userId).catch(() => []);
    pageUrls = pieces.map((p) => ({
      loc: `/p/${p.slug}`,
      lastmod: (p.updated_at || p.published_at || "").slice(0, 10),
    }));
    // Section hubs (/research/<section>) — only those holding a document,
    // dated by the newest document in them.
    hubUrls = sectionsWithDocuments(await listResearch(c.env.DB, userId).catch(() => [])).map(
      (s) => ({ loc: `/research/${topicSlug(s.topic)}`, lastmod: s.lastmod }),
    );
  }
  const urlEntries = [...staticUrls.map((loc) => ({ loc, lastmod: "" })), ...hubUrls, ...pageUrls]
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

// /numbers and /figures are GONE, and the reasoning is worth keeping.
//
// An index of every verified figure was the strongest-evidenced citable
// primitive on paper — statistics with a named source and date. It did not
// survive contact with this corpus. The documents span media theory, public
// health, housing, polling method and carbon finance, so a single global list
// stacks an overdose statistic beside a mortgage rate beside a McLuhan figure
// and asks a reader to make sense of it. "What is numbers" was the correct
// reaction and no name fixed it.
//
// It was also the same structural mistake as /answers: findings ALREADY render
// on each document's own page, beside the thing they are about. The index was
// a second copy of that, stripped of context, competing with its own sources.
// Both paths now 301 to /research, which is where the numbers actually live.
app.get("/numbers", (c) => c.redirect("/research", 301));
app.get("/figures", (c) => c.redirect("/research", 301));
app.get("/research", async (c) => htmlResponse(await renderResearchIndex(c.env)));

// Section hubs — one per entry of the closed list in graph/lib/topics.ts
// (docs/the-record.md §6). An unknown slug is a 404: the list is closed and
// there is nothing to guess. Registered before the retired-prefix redirects
// so nothing further down can shadow it.
app.get("/research/:section", async (c) => {
  const html = await renderSectionHub(c.env, c.req.param("section"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

/** The closed sections that hold at least one published document, each with
 *  the date of its newest one. Shared by the sitemap and llms.txt so the two
 *  announce the same hubs. */
function sectionsWithDocuments(
  docs: Array<{ topic: string | null; updated_at: string; published_at: string | null }>,
): Array<{ topic: string; lastmod: string }> {
  const seen = new Map<string, string>();
  for (const d of docs) {
    const topic = d.topic?.trim();
    // Only the closed list: an unrecognised value has no hub to announce.
    if (!topic || !TOPICS.includes(topic as (typeof TOPICS)[number])) continue;
    const date = (d.updated_at || d.published_at || "").slice(0, 10);
    const prev = seen.get(topic);
    if (prev === undefined || date > prev) seen.set(topic, date);
  }
  return TOPICS.filter((t) => seen.has(t)).map((t) => ({ topic: t, lastmod: seen.get(t) ?? "" }));
}

// RETIRED ROOMS — redirected, never rendered.
//
// A sweep on 2026-09-23 found /watchlist and /videos still resolving as pages
// describing parts of the product that no longer exist. On 2026-09-24 the rest
// of the graph era went the same way (docs/the-record.md §9): topic hubs,
// subject pages, the arrangement pages, records, briefs, activity, the
// instruments index and the studio produce flow. A reachable page that
// describes the wrong product is worse than no page, and a citation already in
// the world must still land somewhere useful, so each goes to the live surface
// that does its job now: subject-shaped URLs go to search for that subject.
app.get("/watchlist", (c) => c.redirect("/library", 301));
app.get("/videos", (c) => c.redirect("/", 301));
app.get("/activity", (c) => c.redirect("/", 301));
app.get("/instruments", (c) => c.redirect("/", 301));
app.get("/topics", (c) => c.redirect("/research", 301));
app.get("/topics/:slug", (c) => c.redirect(searchFor(c.req.param("slug")), 301));

// ---- Investigations -------------------------------------------------------
// The index described "signed analyses", "intent badges" and "the fabric era"
// over a list that was just every published piece again. The documents live
// at /research; this is where the room was pointing anyway.
app.get("/investigations", (c) => c.redirect("/research", 301));

app.get("/investigations/:slug", (c) => c.redirect(`/p/${c.req.param("slug")}`, 301));

// The document page — any kind, as long as it's published or canonical.
// Working-material stays private. The .md twin and retired slugs are handled
// here too, so route order can never shadow them.
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
  // The JSON face: the same model the page renders from (public/models/
  // document.ts), for a front end built against real data. Folded in here
  // for the same reason the twin is. The operator block is present only for
  // the signed-in operator; a reader gets the public model and nothing else.
  if (raw.endsWith(".json")) {
    const model = await documentModel(c.env, raw.slice(0, -5), {
      isOperator: c.get("is_operator") === true,
    });
    if (!model) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
    return new Response(JSON.stringify(model), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        // The reader's model caches like the twin; the operator's carries
        // their forms and leads and must never sit in a shared cache.
        "cache-control": model.operator ? "private, no-store" : "public, max-age=300",
      },
    });
  }
  const slug = raw;
  // Try the piece renderer first (original semantics).
  const html = await renderPiece(c.env, slug, { isOperator: c.get("is_operator") === true });
  if (html) {
    // The "opened" signal resurface reads (migration 0063): the operator,
    // signed in, looked at this document. After the render, off the critical
    // path, never for a reader — and guarded, because c.executionCtx THROWS
    // where there is no ExecutionContext (tests), and a page must never fail
    // to serve because its bookkeeping could not run.
    const operatorId = c.get("operator_id");
    if (c.get("is_operator") === true && operatorId) {
      try {
        c.executionCtx.waitUntil(
          c.env.DB.prepare("UPDATE pieces SET last_opened_at = ? WHERE slug = ? AND user_id = ?")
            .bind(new Date().toISOString(), slug, operatorId)
            .run()
            .then(() => {})
            .catch(() => {}),
        );
      } catch {
        // No execution context — the page still serves.
      }
    }
    return htmlResponse(html);
  }

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
  return htmlResponse(renderNotFound(c.req.path), { status: 404 });
});

app.get("/s/:slug", (c) => c.redirect(searchFor(c.req.param("slug")), 301));

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

  const confirmToken = crypto.randomUUID();
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
      confirmToken,
    )
    .run();
  // The confirmation. Anyone can type anyone's address into a public form, so
  // an unconfirmed row is an assertion about someone who has not agreed to
  // anything — which is why `confirmed` is in the schema and why it stayed 0
  // for every row until this existed.
  //
  // waitUntil, not awaited: the provider's latency is not the subscriber's
  // problem, and a mail failure must not turn a successful signup into an
  // error page. If it fails the row simply stays unconfirmed, which is the
  // correct end state anyway.
  const { sendConfirmation } = await import("../lib/email");
  // Started before it is handed anywhere, so it runs either way.
  const confirming = sendConfirmation(c.env, email, confirmToken).then(
    () => undefined,
    () => undefined,
  );
  // waitUntil when there is a context to wait in, and never at the cost of the
  // response: Hono THROWS on `c.executionCtx` when none exists, which turned a
  // successful signup into a 500 and told the reader they were not on the list
  // when they were. The mail is best-effort; the subscription is not.
  try {
    c.executionCtx.waitUntil(confirming);
  } catch {
    // No execution context — the send is already in flight, unawaited.
  }
  return htmlResponse(renderSubscribed(false));
});

app.get("/confirm", async (c) => {
  const token = c.req.query("token") ?? "";
  if (!token) return htmlResponse(renderSubscribed(false), { status: 400 });
  // Single-use: the token is cleared as it is spent, so a forwarded or
  // logged link cannot confirm the address a second time.
  const res = await c.env.DB.prepare(
    `UPDATE pub_subscriptions SET confirmed = 1, confirmation_token = NULL
      WHERE confirmation_token = ?`,
  )
    .bind(token)
    .run()
    .catch(() => null);
  const ok = (res?.meta?.changes ?? 0) > 0;
  return htmlResponse(renderConfirmed(ok), { status: ok ? 200 : 404 });
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

// ---- the machine face -----------------------------------------------------
//
// llms.txt and feed.json are generated from the same listPublishedPieces()
// query the sitemap uses, so the three can never disagree about what exists.

app.get("/llms.txt", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  const pieces = userId ? await listPublishedPieces(c.env.DB, userId).catch(() => []) : [];
  const sections = userId
    ? sectionsWithDocuments(await listResearch(c.env.DB, userId).catch(() => [])).map(
        (s) => s.topic,
      )
    : [];
  return new Response(llmsTxt(pieces, sections), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
});

// Every published document's plain-text twin in one file, for a crawler that
// would rather take the corpus whole than follow fifty links. Same rows, same
// pieceMarkdown() as each /p/<slug>.md — one query, one rendering, so it can
// never disagree with the pages.
app.get("/llms-full.txt", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  const pieces = userId ? await listPublishedPiecesFull(c.env.DB, userId).catch(() => []) : [];
  return new Response(llmsFullTxt(pieces), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
});

// IndexNow key file — lib/indexnow.ts POSTs `keyLocation` pointing here, and
// the search engines fetch it to prove the ping came from this host. Only
// served when a key is configured; any other `/<something>.txt` falls through.
app.get("/:key{[A-Za-z0-9-]{8,128}\\.txt}", async (c, next) => {
  const key = indexNowKey(c.env);
  const asked = c.req.param("key").slice(0, -4);
  if (!key || asked !== key) return next();
  return new Response(`${key}\n`, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=86400",
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
  const html = await renderPiece(c.env, c.req.param("slug"), {
    isOperator: c.get("is_operator") === true,
  });
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

// The thirteen graph-era "arrangement" URL prefixes and the entity record.
// Each was a view of a subject; search for the subject is what serves now.
for (const prefix of [
  "d",
  "t",
  "profile",
  "n",
  "pr",
  "w",
  "b",
  "c",
  "f",
  "stat",
  "l",
  "m",
  "ct",
  "record",
]) {
  app.get(`/${prefix}/:slug`, (c) => c.redirect(searchFor(c.req.param("slug")), 301));
}
app.get("/doc/:slug", (c) => c.redirect(`/library/${c.req.param("slug")}`, 301));

app.get("/record", (c) => c.redirect("/", 301));

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
app.get("/patterns", (c) => c.redirect("/research", 301));

// ---- Library --------------------------------------------------------------

// /library is now the OPERATOR's working surface, not a public door: it
// lists working-material alongside published pieces and carries the upload
// dropzone.
//
// IT USED TO 301 A LOGGED-OUT VISITOR TO /research, and that was the single
// worst thing on the site. This is where uploading happens, it is the page the
// operator needs most, and a lapsed session turned it into a silent bounce to
// a different page with no explanation and no way back in — while exactly one
// link to /auth/* existed anywhere in the codebase. The operator reported, more
// than once, not being able to find where to upload. This was why.
//
// Now it says what it is and where the door is.
app.get("/library", async (c) => {
  if (!c.get("is_operator")) return htmlResponse(renderSignedOut(), { status: 401 });
  const ingested = c.req.query("ingested");
  const error = c.req.query("error");
  const importing = c.req.query("importing");
  const videoError = c.req.query("video_error");
  const published = c.req.query("published");
  const renamed = c.req.query("renamed");
  const queued = c.req.query("queued");
  // The upload just made: POST /op/feed/upload redirects here carrying the
  // new piece ids (comma-separated for a zip), and the page opens on them.
  const uploaded = c.req.query("uploaded");
  return htmlResponse(
    await renderLibraryIndex(c.env, {
      isOperator: c.get("is_operator"),
      ...(uploaded ? { uploaded } : {}),
      ...(ingested ? { ingested } : {}),
      ...(error ? { error } : {}),
      ...(importing ? { importing } : {}),
      ...(videoError ? { videoError } : {}),
      ...(published ? { published } : {}),
      ...(renamed ? { renamed } : {}),
      ...(queued ? { queued } : {}),
    }),
  );
});

// The same model /library renders, as JSON — the data seam for a front end
// built against real data (public/models/library.ts). Operator-only, like the
// page; a reader gets a 404, not a 401, because the URL is not a door.
app.get("/library.json", async (c) => {
  if (c.get("is_operator") !== true) return c.notFound();
  const operatorId = await resolveOperatorId(c.env.DB);
  // Only the flashes actually present, so an absent query key stays absent.
  const opts: Record<string, string> = {};
  for (const [key, param] of [
    ["uploaded", "uploaded"],
    ["importing", "importing"],
    ["videoError", "video_error"],
    ["ingested", "ingested"],
    ["error", "error"],
    ["published", "published"],
    ["renamed", "renamed"],
    ["queued", "queued"],
  ] as const) {
    const v = c.req.query(param);
    if (v) opts[key] = v;
  }
  const model = operatorId
    ? await libraryModel(c.env, { ...opts, userId: operatorId })
    : emptyLibraryModel(c.env, opts);
  return new Response(JSON.stringify(model), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
});

app.get("/briefs/:slug", (c) => c.redirect(`/p/${c.req.param("slug")}`, 301));

// ---- Utility pages (still placeholders until trailing Phase 2) -----------

// About is a real page again. It used to 301 to /method, which left the site
// with a page on how verification works and none on what the site is — the
// first thing both a reader and an answer engine want to know.
app.get("/about", () => htmlResponse(renderAbout()));

// Method — how verification works, in plain words. Linked from /about.
app.get("/method", () => htmlResponse(renderMethodology()));

app.get("/methodology", (c) => c.redirect("/method", 301));

// /how-it-works rendered six stat tiles reading "undefined" above an
// explainer of the arrangement/signed-layer/faces/studio architecture, none
// of which is the product. /method is the page that explains how the record
// is kept, and it is the one the footer and the trust line already point at.
app.get("/how-it-works", (c) => c.redirect("/method", 301));

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
      asked: c.req.query("asked") === "1",
    }),
  );
});

// The same search as JSON — the model /search renders from, served as is
// (public/models/search.ts). One query set, two surfaces. The operator block
// (the ask/research actions and a miss's preview) is only ever built for a
// signed-in operator; a reader gets null there. Never cached: a stored answer
// can land between two requests.
app.get("/search.json", async (c) => {
  const q = c.req.query("q") ?? "";
  const model = await searchModel(c.env, q, {
    isOperator: c.get("is_operator") === true,
    asked: c.req.query("asked") === "1",
  });
  return new Response(JSON.stringify(model), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
});

app.get("/bulk-expand", (c) => c.redirect("/library", 301));
app.get("/studio/*", (c) => c.redirect("/", 301));

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
