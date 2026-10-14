// The Black Box public site — mounted in front of the old public routes.
//
// docs/blackbox/ROUTES.md is the map. A route here answers when it can and
// calls next() when it cannot, so anything not yet rebuilt still reaches the
// renderer that served it before (src/public/routes.ts) instead of a 404.

import { Hono } from "hono";
import { OWN_UPLOADS_SQL } from "../admin/runtime";
import type { AuthContext } from "../auth/middleware";
import { one } from "../lib/d1";
import { resolveOperatorId } from "../public/data";
import { claudeRoute, transcript } from "../write/agent";
import { draftArticle, draftMarkdown } from "../write/article";
import { checkQuotes, draftQuotes } from "../write/check";
import { d1Drafts } from "../write/drafts";
import { d1Entries } from "../write/entries";
import { articleTopics, changedSince, latestVersion, publishProblems } from "../write/publish";
import { START_READ, d1Reads } from "../write/read";
import { checkReport, d1Sources, reportFile, reportProblems } from "../write/research";
import { sourceTexts, sourceTitles } from "../write/sources";
import { adminModel, waitingCount } from "./admin-data";
import {
  allPapers,
  anyResearchDoc,
  article,
  libraryItems,
  paper,
  privatePage,
  problem,
  researchDoc,
  shownRead,
  staticPage,
  term,
} from "./content/store";
import { docViewFromStore, hubTopics, listedArticles, topicBySlug } from "./data";
import {
  SITE as FEED_SITE,
  feedHeaders,
  feedItems,
  jsonFeed,
  llmsFullTxt,
  llmsTxt,
  rssFeed,
  topicsFromParam,
} from "./feeds";
import { html, setWaiting } from "./layout";
import { passageHref } from "./md";
import { renderAdmin } from "./pages/admin";
import { renderArticle, renderPaper } from "./pages/article";
import { type DocView, renderDocument } from "./pages/document";
import { evidence } from "./pages/evidence";
import { consentWording, followTopics, renderFollow } from "./pages/follow";
import { renderFront } from "./pages/front";
import { renderIdea } from "./pages/idea";
import { renderIdeas } from "./pages/ideas";
import { INVESTIGATIONS, type LibraryQuery, renderLibrary } from "./pages/library";
import { renderNotFound, renderNotice } from "./pages/notice";
import { receiptLine, renderReadBoard } from "./pages/read";
import { renderSearch } from "./pages/search";
import { renderStatic } from "./pages/static";
import { renderTopic } from "./pages/topic";
import {
  PREVIEW_FLAG,
  proposalCard,
  renderEmptyPreview,
  renderWorkspace,
  renderWriteList,
} from "./pages/write";
import { SITE_JS } from "./script";
import { SITE_CSS } from "./styles";
import { kindColours, shortDate } from "./theme";
import { refreshUploads } from "./uploads";

const app = new Hono<AuthContext>();

// Published Admin uploads join the public lists (site/uploads.ts). Cached per
// isolate for a minute; the static assets do not need them.
app.use("*", async (c, next) => {
  if (!/^\/(site\.(css|js)|favicon)/.test(c.req.path)) {
    // ?fresh=1 (the link after a publish) reads D1 now rather than within
    // the minute, so the author never lands on a 404 for a new page.
    await refreshUploads(c.env, signedIn(c) && c.req.query("fresh") === "1");
    // The Admin pill carries its count on every page, as the prototype does.
    if (signedIn(c)) {
      const userId = await resolveOperatorId(c.env.DB).catch(() => null);
      setWaiting(userId ? await waitingCount(c.env, userId) : 0);
    }
  }
  await next();
});
type Env = AuthContext["Bindings"];

const signedIn = (c: { get: (k: "is_operator") => unknown }) => c.get("is_operator") === true;

app.get(
  "/site.css",
  () =>
    new Response(SITE_CSS, {
      headers: {
        "content-type": "text/css; charset=utf-8",
        "cache-control": "public, max-age=31536000, immutable",
      },
    }),
);

app.get(
  "/site.js",
  () =>
    new Response(SITE_JS, {
      headers: {
        "content-type": "text/javascript; charset=utf-8",
        "cache-control": "public, max-age=31536000, immutable",
      },
    }),
);

app.get("/", (c) => html(renderFront({ signedIn: signedIn(c) })));

function libraryQuery(q: (k: string) => string | undefined): LibraryQuery {
  return {
    kind: q("kind") ?? q("k"),
    topic: q("topic") ?? q("t"),
    sub: q("sub"),
    sort: q("sort"),
    q: q("q"),
    page: q("page"),
    topics: q("topics"),
  };
}

app.get("/library", (c) =>
  html(
    renderLibrary(
      libraryQuery((k) => c.req.query(k)),
      { signedIn: signedIn(c) },
    ),
  ),
);

app.get("/investigations", (c) =>
  html(
    renderLibrary(
      libraryQuery((k) => c.req.query(k)),
      {
        signedIn: signedIn(c),
        shelf: INVESTIGATIONS,
      },
    ),
  ),
);

// The page was /desk for its first hour; old links keep working.
app.get("/desk", (c) => c.redirect(`/admin${new URL(c.req.url).search}`, 301));
app.get("/desk/:rest{.+}", (c) => c.redirect(`/admin/${c.req.param("rest")}`, 301));

// ---- admin (signed in) -------------------------------------------------------------

const signIn = (path: string) =>
  renderNotice({
    title: "Sign in to use Admin",
    body: "Admin is where uploads wait for a decision. It is only for the author.",
    path,
    links: [{ href: `/op/login?next=${encodeURIComponent(path)}`, label: "Sign in" }],
  });

app.get("/admin", async (c) => {
  if (!signedIn(c)) return html(signIn("/admin"), { status: 401 });
  const userId = await resolveOperatorId(c.env.DB).catch(() => null);
  const model = userId
    ? await adminModel(c.env, userId)
    : { waiting: [], failed: [], kept: [], published: [] };
  // What each document's read found, on its card.
  const reads = userId ? await d1Reads(c.env, userId).latestAll() : new Map();
  return html(
    renderAdmin(
      model,
      {
        uploaded: c.req.query("uploaded"),
        ingested: c.req.query("ingested"),
        dupes: c.req.query("dupes"),
        dedup: c.req.query("dedup"),
        error: c.req.query("error"),
        done: c.req.query("done"),
      },
      reads,
    ),
  );
});

/** A private read of a waiting upload or a held document: the same page a
 *  reader would get, marked private and kept out of every index. */
// ---- the workspace: write with Claude, beside the page -------------------------

async function workspaceStore(c: { env: Env }) {
  const userId = await resolveOperatorId(c.env.DB).catch(() => null);
  return userId ? d1Drafts(c.env, userId) : null;
}

app.get("/admin/write", async (c) => {
  if (!signedIn(c)) return html(signIn("/admin/write"), { status: 401 });
  const store = await workspaceStore(c);
  const drafts = store ? await store.list().catch(() => []) : [];
  return html(renderWriteList(drafts, { hasKey: !!claudeRoute(c.env), route: claudeRoute(c.env) }));
});

app.get("/admin/write/:id", async (c, next) => {
  if (!signedIn(c)) return html(signIn(c.req.path), { status: 401 });
  const store = await workspaceStore(c);
  const d = store ? await store.get(c.req.param("id")).catch(() => null) : null;
  if (!store || !d) return next();
  const items = transcript(await store.messages(d.id));
  if (d.kind === "read") {
    const uid = (await resolveOperatorId(c.env.DB).catch(() => null)) ?? "";
    const read = d.meta.readId ? await d1Reads(c.env, uid).get(d.meta.readId) : null;
    const docId = d.meta.based_on?.[0] ?? "";
    const title = (await sourceTitles(c.env, [docId])).get(docId) ?? docId;
    return html(
      renderWorkspace(
        d,
        items,
        { total: 0, failed: [] },
        {
          hasKey: !!claudeRoute(c.env),
          route: claudeRoute(c.env),
          read: {
            receipt: read ? receiptLine(read) : "No read recorded",
            docId,
            readId: read?.id ?? "",
            shown: read?.status === "shown",
          },
          // Read it was just pressed: the page sends the first message once.
          autostart:
            c.req.query("start") === "1" && !items.length ? START_READ(title, docId) : undefined,
          flash: { error: c.req.query("error"), done: c.req.query("done") },
        },
      ),
    );
  }
  if (d.kind === "research") {
    const uid = (await resolveOperatorId(c.env.DB).catch(() => null)) ?? "";
    const pages = await d1Sources(c.env, uid).texts(d.id);
    const rcheck = checkReport(d.body, pages);
    return html(
      renderWorkspace(d, items, rcheck, {
        hasKey: !!claudeRoute(c.env),
        route: claudeRoute(c.env),
        research: {
          problems: d.body.trim()
            ? reportProblems(d, rcheck, articleTopics())
            : ["Nothing is written yet."],
          pages: pages.length,
          savedAs: d.meta.savedAs,
        },
        flash: { error: c.req.query("error"), done: c.req.query("done") },
      }),
    );
  }
  const quoted = draftQuotes(d.body).map((q) => q.doc);
  const check = checkQuotes(d.body, await sourceTexts(c.env, quoted));
  const userId = (await resolveOperatorId(c.env.DB).catch(() => null)) ?? "";
  const live = await latestVersion(c.env, userId, d.id);
  const problems = d.body.trim()
    ? await publishProblems(c.env, userId, d)
    : ["Nothing is written yet."];
  const proposals = await d1Entries(c.env, userId).forDraft(d.id);
  const propTitles = await sourceTitles(
    c.env,
    proposals.map((e) => e.data.doc),
  );
  const cards = new Map(
    proposals
      .filter((e) => e.toolUseId)
      .map((e) => [e.toolUseId as string, proposalCard(e, d.id, propTitles.get(e.data.doc))]),
  );
  return html(
    renderWorkspace(d, items, check, {
      hasKey: !!claudeRoute(c.env),
      route: claudeRoute(c.env),
      cards,
      publish: { problems, live, changed: live ? changedSince(d, live) : true },
      // "Write this" opened it: the page sends the brief once.
      autostart: c.req.query("start") === "1" && !items.length ? d.meta.seed : undefined,
      flash: {
        published: c.req.query("published"),
        error: c.req.query("error"),
        done: c.req.query("done"),
      },
    }),
  );
});

/** The article as it will be published: the public renderer, with failing
 *  quotations in red and a click-to-flag script. Never indexed. */
app.get("/admin/write/:id/preview", async (c, next) => {
  if (!signedIn(c)) return html(signIn(c.req.path), { status: 401 });
  const store = await workspaceStore(c);
  const d = store ? await store.get(c.req.param("id")).catch(() => null) : null;
  if (!d) return next();
  // A read previews as its board: the cards, kept or dismissed in place.
  if (d.kind === "read") {
    const uid = (await resolveOperatorId(c.env.DB).catch(() => null)) ?? "";
    const reads = d1Reads(c.env, uid);
    const read = d.meta.readId ? await reads.get(d.meta.readId) : null;
    if (!read) return html(renderEmptyPreview(d.kind));
    const title = (await sourceTitles(c.env, [read.docId])).get(read.docId) ?? read.docId;
    return html(renderReadBoard(read, await reads.derivations(read.id), title));
  }
  if (!d.body.trim()) return html(renderEmptyPreview(d.kind));
  // A research report previews as the document page it will become.
  if (d.kind === "research") {
    const page = renderDocument(
      {
        id: d.id,
        title: d.meta.title || "Untitled research",
        kind: "Research",
        topic: d.meta.topic || "Research",
        date: new Date().toISOString().slice(0, 10),
        dateLabel: "Not yet published",
        shelf: "",
        body: d.body,
        citedBy: [],
      },
      { signedIn: true },
    );
    return html(page.replace("</body>", `${PREVIEW_FLAG}</body>`));
  }
  const ids = [...new Set([...draftQuotes(d.body).map((q) => q.doc), ...(d.meta.based_on ?? [])])];
  const [texts, titles] = await Promise.all([sourceTexts(c.env, ids), sourceTitles(c.env, ids)]);
  const failed = new Set(checkQuotes(d.body, texts).failed.map((f) => `${f.doc}\u0000${f.text}`));
  const page = renderArticle(draftArticle(d, titles), {
    signedIn: true,
    noindex: true,
    docTitle: (id) => titles.get(id) ?? null,
    quoteOk: (doc, text) => !failed.has(`${doc}\u0000${text}`),
  });
  return html(page.replace("</body>", `${PREVIEW_FLAG}</body>`));
});

app.get("/admin/write/:id/article.md", async (c, next) => {
  if (!signedIn(c)) return html(signIn(c.req.path), { status: 401 });
  const store = await workspaceStore(c);
  const d = store ? await store.get(c.req.param("id")).catch(() => null) : null;
  if (!d) return next();
  const titles = await sourceTitles(c.env, d.meta.based_on ?? []);
  const slug = draftArticle(d, titles).slug;
  return new Response(d.kind === "research" ? reportFile(d) : draftMarkdown(d, titles), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${slug}.md"`,
    },
  });
});

// The projects (Aldershot, Ancaster): ported as-is, for the author only.
app.get("/admin/projects/:id", (c, next) => {
  const path = `/admin/projects/${c.req.param("id")}`;
  if (!signedIn(c)) return html(signIn(path), { status: 401 });
  const p = privatePage(path);
  return p ? html(renderStatic(p, { signedIn: true })) : next();
});

app.get("/admin/review/:id", async (c) => {
  if (!signedIn(c)) return html(signIn(c.req.path), { status: 401 });
  const id = c.req.param("id");
  const held = anyResearchDoc(id);
  let view: DocView | null = held
    ? {
        id: held.id,
        title: held.title,
        kind: held.kind,
        topic: held.topic,
        date: held.date,
        dateLabel: held.date ? shortDate(held.date) : "",
        shelf: "",
        body: held.body,
        citedBy: [],
      }
    : null;
  if (!view) {
    const userId = await resolveOperatorId(c.env.DB).catch(() => null);
    const row = userId
      ? await one<{ slug: string; title: string; body_md: string | null; created_at: string }>(
          c.env.DB,
          `SELECT slug, title, body_md, created_at FROM pieces WHERE id = ? AND user_id = ? AND ${OWN_UPLOADS_SQL}`,
          [id, userId],
        ).catch(() => null)
      : null;
    if (row) {
      view = {
        id: row.slug,
        title: row.title,
        kind: "Waiting in Admin",
        topic: "Other",
        date: row.created_at.slice(0, 10),
        dateLabel: shortDate(row.created_at.slice(0, 10)),
        shelf: "",
        body: row.body_md ?? "",
        citedBy: [],
      };
    }
  }
  if (!view) return html(renderNotFound(c.req.path, true), { status: 404 });
  const page = renderDocument(view, { signedIn: true })
    .replace("<head>", '<head>\n<meta name="robots" content="noindex,nofollow" />')
    .replace(
      '<div class="dwrap">',
      '<p class="d-flash bad" style="margin:0 0 20px">Private — this is not published. <a href="/admin" class="ulink">Back to Admin</a></p><div class="dwrap">',
    );
  return new Response(page, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" },
  });
});

// ---- sitemap -------------------------------------------------------------------

/** Every public page, from the same store the pages render from. Search
 *  result pages and filtered library views are left out on purpose: they
 *  would compete with the documents they list. */
app.get("/sitemap.xml", () => {
  const urls: Array<[string, string]> = [
    ["/", ""],
    ["/library", ""],
    ["/ideas", ""],
    ["/investigations", ""],
    ["/about", ""],
    ["/follow", ""],
    ...hubTopics().map((t): [string, string] => [`/topics/${t.slug}`, ""]),
    ...listedArticles().map((a): [string, string] => [`/articles/${a.slug}`, a.date]),
    ...allPapers().map((p): [string, string] => [`/articles/${p.slug}`, p.date]),
    ...libraryItems()
      .filter((r) => r.kind !== "Article" && r.kind !== "Paper" && r.kind !== "Project")
      .map((r): [string, string] => [r.route, r.date]),
  ];
  const seen = new Set<string>();
  const body = urls
    .filter(([loc]) => loc.startsWith("/") && !loc.includes("?") && !seen.has(loc) && seen.add(loc))
    .map(
      ([loc, lastmod]) =>
        `  <url><loc>https://canopticon.com${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`,
    )
    .join("\n");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`,
    {
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    },
  );
});

// ---- the mailing list's landing pages -------------------------------------------

app.get("/confirm", async (c) => {
  const token = c.req.query("token") ?? "";
  const row = token
    ? await one<{ id: string }>(
        c.env.DB,
        "SELECT id FROM pub_subscriptions WHERE confirmation_token = ?",
        [token],
      ).catch(() => null)
    : null;
  // Single-use: the token is cleared as it is spent.
  const res = row
    ? await c.env.DB.prepare(
        "UPDATE pub_subscriptions SET confirmed = 1, confirmation_token = NULL WHERE id = ?",
      )
        .bind(row.id)
        .run()
        .catch(() => null)
    : null;
  const ok = (res?.meta?.changes ?? 0) > 0;
  return html(
    renderNotice({
      title: ok ? "You're on the list" : "That link has already been used",
      body: ok
        ? "Confirmed. You'll get one email a week, only when something new is published, and every email has a one-click unsubscribe."
        : "Confirmation links work once. If you have confirmed already, there is nothing more to do.",
      path: "/confirm",
      links: [{ href: "/", label: "Back to the front page" }],
    }),
    { status: ok ? 200 : 404 },
  );
});

app.get("/unsubscribe", async (c) => {
  const token = c.req.query("token") ?? "";
  // Immediate, not "within ten business days": the law sets a ceiling, and
  // there is no reason to come anywhere near it.
  const row = token
    ? await one<{ id: string }>(
        c.env.DB,
        "SELECT id FROM pub_subscriptions WHERE unsubscribe_token = ? AND unsubscribed_at IS NULL",
        [token],
      ).catch(() => null)
    : null;
  const res = row
    ? await c.env.DB.prepare("UPDATE pub_subscriptions SET unsubscribed_at = ? WHERE id = ?")
        .bind(new Date().toISOString(), row.id)
        .run()
        .catch(() => null)
    : null;
  const ok = (res?.meta?.changes ?? 0) > 0;
  return html(
    renderNotice({
      title: ok ? "Unsubscribed" : "Nothing to unsubscribe",
      body: ok
        ? "Done. Nothing more will be sent to this address."
        : "This link is not attached to an active subscription — it may have been used already.",
      path: "/unsubscribe",
      links: [{ href: "/", label: "Back to the front page" }],
    }),
    { status: ok ? 200 : 404 },
  );
});

// ---- redirects from the live site (docs/blackbox/ROUTES.md) -------------------

app.get("/essays", (c) => c.redirect("/library?kind=Article", 301));
app.get("/articles", (c) => c.redirect("/library?kind=Article", 301));
app.get("/essays/:slug", (c) =>
  c.redirect(`/articles/${encodeURIComponent(c.req.param("slug"))}`, 301),
);
app.get("/research", (c) => c.redirect("/library?kind=Research", 301));
app.get("/method", (c) => c.redirect("/about#m-rules", 301));
app.get("/methodology", (c) => c.redirect("/about#m-rules", 301));
app.get("/how-it-works", (c) => c.redirect("/about#m-rules", 301));
app.get("/topics", (c) => c.redirect("/library", 301));

/** The eight closed sections of the old site, mapped by hand to the topic
 *  that holds most of what each one held. Old hub slugs turned "&" into a
 *  space ("politics-government"); both spellings are accepted. */
const OLD_SECTIONS: Record<string, string> = {
  "politics-government": "canadian-politics-and-power",
  "media-information": "mcluhan-and-media-theory",
  "public-health": "drugs-and-public-health",
  "housing-cities": "housing",
  "money-markets": "prices-and-markets",
  "climate-energy": "net-zero-finance",
  "technology-systems": "ai-directed-development",
  "method-measurement": "polling",
};
app.get("/research/:section", (c) => {
  const s = c.req.param("section").replace(/-and-/g, "-");
  const topic = OLD_SECTIONS[s];
  return c.redirect(topic ? `/topics/${topic}` : "/library?kind=Research", 301);
});

/** A verbatim-quote receipt from the old site: go to the passage itself. */
app.get("/q/:id", async (c) => {
  const userId = await resolveOperatorId(c.env.DB).catch(() => null);
  if (!userId) return html(renderNotFound(c.req.path, signedIn(c)), { status: 404 });
  const q = await one<{ verbatim_text: string; slug: string | null }>(
    c.env.DB,
    `SELECT q.verbatim_text, p.slug
       FROM quotes q
       JOIN nodes src ON src.id = q.source_id
       LEFT JOIN pieces p ON p.id = src.piece_id
      WHERE q.id = ? AND q.user_id = ?`,
    [c.req.param("id"), userId],
  ).catch(() => null);
  if (!q?.slug) return html(renderNotFound(c.req.path, signedIn(c)), { status: 404 });
  return c.redirect(passageHref(q.slug, q.verbatim_text), 301);
});

// ---- feeds (docs/blackbox/BACKEND.md) ----------------------------------------

// ?t=a,b narrows the main feed to topics — the Follow page's combined feed.
app.get("/feed.xml", (c) => {
  const topics = topicsFromParam(c.req.query("t"));
  const self = `${FEED_SITE}/feed.xml${topics.length ? `?t=${c.req.query("t")}` : ""}`;
  return new Response(rssFeed(feedItems(topics), self), {
    headers: feedHeaders("application/rss+xml; charset=utf-8", self),
  });
});

app.get("/feed.json", (c) => {
  const topics = topicsFromParam(c.req.query("t"));
  const self = `${FEED_SITE}/feed.json${topics.length ? `?t=${c.req.query("t")}` : ""}`;
  return new Response(jsonFeed(feedItems(topics), self), {
    headers: feedHeaders("application/feed+json; charset=utf-8", self),
  });
});

app.get("/feeds/:file", (c, next) => {
  const m = /^([a-z0-9-]+)\.(xml|json)$/.exec(c.req.param("file"));
  const topics = m ? topicsFromParam(m[1]) : [];
  const topic = topics[0];
  if (!m || !topic) return next();
  const self = `${FEED_SITE}/feeds/${m[1]}.${m[2]}`;
  const title = `${topic} · Canopticon`;
  return m[2] === "xml"
    ? new Response(rssFeed(feedItems([topic]), self, title), {
        headers: feedHeaders("application/rss+xml; charset=utf-8", self),
      })
    : new Response(jsonFeed(feedItems([topic]), self, title), {
        headers: feedHeaders("application/feed+json; charset=utf-8", self),
      });
});

// Hovercards (site.js): a link's kind, title, dek and stat, for the public
// rows only — the same list the Library shows a reader.
app.get("/hovercards.json", () => {
  const out: Record<
    string,
    { kind: string; title: string; dek: string; meta: string; bg: string; fg: string }
  > = {};
  for (const r of libraryItems()) {
    if (!/^\/(articles|p|concepts|open)\/[^/#?]+$/.test(r.route)) continue;
    const [bg, fg] = kindColours(r.kind);
    out[r.route] = { kind: r.kind, title: r.title, dek: r.dek ?? "", meta: r.stat ?? "", bg, fg };
  }
  return new Response(JSON.stringify(out), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
});

app.get(
  "/llms.txt",
  () =>
    new Response(llmsTxt(), {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    }),
);

app.get(
  "/llms-full.txt",
  () =>
    new Response(llmsFullTxt(), {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    }),
);

// ---- follow ------------------------------------------------------------------

app.get("/follow", (c) => {
  const topic = c.req.query("topic");
  return html(
    renderFollow({
      email: c.req.query("email"),
      topics: topic ? [topic] : [],
      signedIn: signedIn(c),
    }),
  );
});

const EMAIL_RE = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

/**
 * A subscription request: double opt-in, with the consent record CASL asks
 * for — when, from where, which form, which topics, and the exact sentence
 * the person was shown (computed from what they submitted, which is what the
 * page displayed). Nothing is mailed until a key AND a mailing address exist
 * (lib/email.ts); the row is kept either way, unconfirmed.
 */
app.post("/follow", async (c) => {
  const form = await c.req.formData();
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  const known = new Set(followTopics().map((t) => t.name));
  const topics = form
    .getAll("topic")
    .map(String)
    .filter((t) => known.has(t));
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return html(
      renderFollow({
        email,
        topics,
        error: "That doesn't look like an email address.",
        signedIn: signedIn(c),
      }),
      { status: 400 },
    );
  }
  const userId = await resolveOperatorId(c.env.DB).catch(() => null);
  if (!userId) {
    return html(
      renderFollow({
        email,
        topics,
        error: "The mailing list isn't accepting sign-ups yet.",
        signedIn: signedIn(c),
      }),
      { status: 503 },
    );
  }
  const consent = JSON.stringify({
    at: new Date().toISOString(),
    ip: c.req.header("cf-connecting-ip") ?? "",
    source: "/follow (weekly email form)",
    topics,
    wording: consentWording(topics),
  });
  const existing = await one<{ id: string; confirmed: number }>(
    c.env.DB,
    "SELECT id, confirmed FROM pub_subscriptions WHERE email = ? AND thesis_id IS NULL AND unsubscribed_at IS NULL",
    [email],
  ).catch(() => null);
  let token: string | null = null;
  if (existing) {
    // A repeat: record the newer topics and consent; a confirmed subscriber
    // is not asked to confirm again.
    if (!existing.confirmed) token = crypto.randomUUID();
    await c.env.DB.prepare(
      `UPDATE pub_subscriptions SET topics = ?, consent = ?${token ? ", confirmation_token = ?" : ""} WHERE id = ?`,
    )
      .bind(...[JSON.stringify(topics), consent, ...(token ? [token] : []), existing.id])
      .run();
  } else {
    token = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO pub_subscriptions (id, user_id, email, channels, unsubscribe_token, confirmation_token, topics, consent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        crypto.randomUUID(),
        userId,
        email,
        JSON.stringify(["weekly"]),
        crypto.randomUUID(),
        token,
        JSON.stringify(topics),
        consent,
      )
      .run();
  }
  if (token) {
    const { sendConfirmation } = await import("../lib/email");
    const sending = sendConfirmation(c.env, email, token).then(
      () => undefined,
      () => undefined,
    );
    try {
      c.executionCtx.waitUntil(sending);
    } catch {
      // No execution context (tests): the send is already in flight.
    }
  }
  return html(renderFollow({ sent: email, topics, signedIn: signedIn(c) }));
});

app.get("/ideas", (c) => html(renderIdeas({ signedIn: signedIn(c) })));

app.get("/search", (c) =>
  html(
    renderSearch(
      {
        q: c.req.query("q") ?? c.req.query("find"),
        tab: c.req.query("tab"),
        topic: c.req.query("topic"),
        more: c.req.query("more"),
      },
      { signedIn: signedIn(c) },
    ),
  ),
);

// The old per-document URL. Documents live at /p/<id>.
app.get("/library/:slug", (c) => c.redirect(`/p/${encodeURIComponent(c.req.param("slug"))}`, 301));

// Built at request time for any topic with a hub. An unknown slug falls
// through, so the retired subject-search redirect still answers it.
app.get("/topics/:slug", (c, next) => {
  const topic = topicBySlug(c.req.param("slug"));
  return topic ? html(renderTopic(topic, { signedIn: signedIn(c) })) : next();
});

// The hand-built pages: About, three concepts, one open problem.
for (const route of [
  "/about",
  "/concepts/self-extinguishing-maintenance",
  "/concepts/cpai",
  "/concepts/the-overhearer",
  "/open/hot-coffee-whey",
]) {
  app.get(route, (c, next) => {
    const p = staticPage(route);
    return p ? html(renderStatic(p, { signedIn: signedIn(c) })) : next();
  });
}

app.get("/concepts/:id", (c, next) => {
  const t = term(c.req.param("id"));
  return t ? html(renderIdea(t, "Concept", { signedIn: signedIn(c) })) : next();
});

app.get("/open/:id", (c, next) => {
  const p = problem(c.req.param("id"));
  return p ? html(renderIdea(p, "Open problem", { signedIn: signedIn(c) })) : next();
});

// ---- documents --------------------------------------------------------------

/** A document's plain-text twin: the stored Markdown under a short
 *  front-matter block. One body, two faces (standing rule 3). */
function markdownTwin(
  d: { id: string; title: string; kind: string; topic: string; date: string; body: string },
  route: string,
): Response {
  const fm = [
    "---",
    `title: ${JSON.stringify(d.title)}`,
    `kind: ${JSON.stringify(d.kind)}`,
    `topic: ${JSON.stringify(d.topic)}`,
    `date: ${JSON.stringify(d.date || "unknown")}`,
    `url: ${JSON.stringify(`https://canopticon.com${route}`)}`,
    'author: "Chris Telford"',
    'license: "CC BY 4.0"',
    "---",
    "",
  ].join("\n");
  return new Response(fm + d.body.replace(/^---[\s\S]*?---\s*/, ""), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

/** An upload made after the handoff lives only in D1. It renders with the
 *  same page; it just has no library row, so no curated date label. */
async function uploadedDoc(env: Env, slug: string): Promise<DocView | null> {
  const userId = await resolveOperatorId(env.DB).catch(() => null);
  if (!userId) return null;
  const row = await one<{
    slug: string;
    title: string;
    body_md: string | null;
    published_at: string | null;
    metadata: string | null;
  }>(
    env.DB,
    `SELECT slug, title, body_md, published_at, metadata FROM pieces
      WHERE user_id = ? AND slug = ? AND publication_status IN ('published', 'canonical')
        AND ${OWN_UPLOADS_SQL}`,
    [userId, slug],
  ).catch(() => null);
  if (!row?.body_md) return null;
  let topic = "Other";
  try {
    const meta = JSON.parse(row.metadata ?? "{}") as { topic?: string; library_topic?: string };
    topic = meta.library_topic ?? meta.topic ?? "Other";
  } catch {
    // Unreadable metadata files the document under Other; the page still serves.
  }
  const date = (row.published_at ?? "").slice(0, 10);
  return {
    id: row.slug,
    title: row.title,
    kind: "Research",
    topic,
    date,
    dateLabel: date ? shortDate(date) : "",
    shelf: "",
    body: row.body_md,
    citedBy: [],
  };
}

app.get("/p/:id", async (c, next) => {
  const raw = c.req.param("id");
  if (raw.endsWith(".md")) {
    const d = researchDoc(raw.slice(0, -3));
    return d ? markdownTwin(d, `/p/${d.id}`) : next();
  }
  if (raw.endsWith(".json")) {
    // The JSON twin of a stored document; D1-only uploads keep the old model.
    const d = researchDoc(raw.slice(0, -5));
    if (!d) return next();
    return new Response(
      JSON.stringify({
        id: d.id,
        url: `https://canopticon.com/p/${d.id}`,
        title: d.title,
        kind: d.kind,
        topic: d.topic,
        date: d.date || null,
        author: "Chris Telford",
        license: "CC BY 4.0",
        markdown: d.body,
      }),
      {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, max-age=300",
        },
      },
    );
  }
  const view = docViewFromStore(raw) ?? (await uploadedDoc(c.env, raw));
  if (view) {
    const ev = evidence(shownRead(view.id));
    if (!signedIn(c)) return html(renderDocument(view, { evidence: ev }));
    // The author sees Read it, or the read already made.
    const uid = await resolveOperatorId(c.env.DB).catch(() => null);
    const read = uid ? await d1Reads(c.env, uid).latest(view.id) : null;
    return html(
      renderDocument(view, {
        signedIn: true,
        evidence: ev,
        readIt: read?.draftId
          ? { draftId: read.draftId, when: shortDate(read.startedAt.slice(0, 10)) }
          : true,
      }),
    );
  }
  // A retired slug: documents renamed by /v1/admin/reslug keep their old
  // address as an alias, and a citation already in the world must resolve.
  const userId = await resolveOperatorId(c.env.DB).catch(() => null);
  if (userId) {
    const alias = await one<{ slug: string }>(
      c.env.DB,
      `SELECT p.slug FROM piece_slug_aliases a JOIN pieces p ON p.id = a.piece_id
        WHERE a.user_id = ? AND a.old_slug = ?`,
      [userId, raw],
    ).catch(() => null);
    if (alias?.slug && alias.slug !== raw) return c.redirect(`/p/${alias.slug}`, 301);
  }
  return html(renderNotFound(c.req.path, signedIn(c)), { status: 404 });
});

// ---- articles and papers ----------------------------------------------------

app.get("/articles/:slug", async (c, next) => {
  const raw = c.req.param("slug");
  const md = raw.endsWith(".md");
  const slug = md ? raw.slice(0, -3) : raw;
  const a = article(slug);
  if (a) {
    if (md) {
      return markdownTwin(
        { id: a.slug, title: a.title, kind: "Article", topic: a.topic, date: a.date, body: a.body },
        `/articles/${a.slug}`,
      );
    }
    return html(renderArticle(a, { signedIn: signedIn(c) }));
  }
  const p = paper(slug);
  if (p) {
    // The papers are hand-built in the prototype (term links, numbered
    // citations, the reference list, the series) and are ported as-is
    // (content/pages/paper-*.html). The Markdown stays the source for the
    // twin, the feeds and llms-full.txt.
    const built = staticPage(`/articles/${p.slug}`);
    if (built && !md) return html(renderStatic(built, { signedIn: signedIn(c) }));
    if (md) {
      return markdownTwin(
        {
          id: p.slug,
          title: p.title,
          kind: "Paper",
          topic: p.topic ?? "",
          date: p.date,
          body: p.body,
        },
        `/articles/${p.slug}`,
      );
    }
    return html(renderPaper(p, { signedIn: signedIn(c) }));
  }
  return next();
});

export default app;
export { renderNotFound };
