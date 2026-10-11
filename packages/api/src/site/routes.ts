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
import { article, paper, problem, researchDoc, staticPage, term } from "./content/store";
import { docViewFromStore, topicBySlug } from "./data";
import { html } from "./layout";
import { renderArticle, renderPaper } from "./pages/article";
import { type DocView, renderDocument } from "./pages/document";
import { renderFront } from "./pages/front";
import { renderIdea } from "./pages/idea";
import { renderIdeas } from "./pages/ideas";
import { INVESTIGATIONS, type LibraryQuery, renderLibrary } from "./pages/library";
import { renderStatic } from "./pages/static";
import { renderTopic } from "./pages/topic";
import { SITE_JS } from "./script";
import { SITE_CSS } from "./styles";

const app = new Hono<AuthContext>();
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

app.get("/ideas", (c) => html(renderIdeas({ signedIn: signedIn(c) })));

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
  const { shortDate } = await import("./theme");
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
  if (raw.endsWith(".json")) return next();
  const view = docViewFromStore(raw) ?? (await uploadedDoc(c.env, raw));
  if (!view) return next();
  return html(renderDocument(view, { signedIn: signedIn(c) }));
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
