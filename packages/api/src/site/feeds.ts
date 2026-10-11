// The machine face of the Black Box site: RSS, JSON Feed, per-topic feeds,
// llms.txt and llms-full.txt. docs/blackbox/BACKEND.md.
//
// Generated per request from the content store, so a feed can never disagree
// with the page it points at (standing rule 3), and regenerating "at publish
// time" is simply deploying. Items carry full content, not just the dek. Every
// feed names its WebSub hub, in the body and in a Link header.

import type { Article, Paper } from "./content/store";
import { allPapers, libraryItems, researchDoc } from "./content/store";
import { docTitle, listedArticles, topicOf } from "./data";
import { esc } from "./layout";
import { articleHtml, documentHtml } from "./md";
import { topicSlug } from "./theme";

export const SITE = "https://canopticon.com";
export const HUB = "https://pubsubhubbub.appspot.com/";
const DESCRIPTION =
  "Questions researched in depth, and articles written from what the research found.";
/** Newest-first items per feed. Full content makes a feed heavy; a reader
 *  that wants everything has llms-full.txt and the Library. */
const MAX_ITEMS = 30;

export interface FeedItem {
  url: string;
  title: string;
  summary: string;
  html: string;
  date: string;
  topic: string;
  kind: string;
}

/** Relative links inside rendered content become absolute: a feed is read
 *  somewhere that is not canopticon.com. */
const absolute = (h: string) => h.replace(/(href|src)="\//g, `$1="${SITE}/`);

function articleItem(a: Article): FeedItem {
  return {
    url: `${SITE}/articles/${a.slug}`,
    title: a.title,
    summary: a.dek,
    html: absolute(
      `${a.thesis ? `<p><strong>Thesis.</strong> ${esc(a.thesis)}</p>` : ""}${articleHtml(a.body, { docTitle }).html}`,
    ),
    date: a.date,
    topic: topicOf(a),
    kind: "Article",
  };
}

function paperItem(p: Paper): FeedItem {
  return {
    url: `${SITE}/articles/${p.slug}`,
    title: p.title,
    summary: p.dek ?? "",
    html: absolute(documentHtml(p.body).html),
    date: p.date,
    topic: topicOf(p),
    kind: "Paper",
  };
}

/** Every publishable item, newest first. Investigations stay on their shelf. */
export function feedItems(topics: string[] = []): FeedItem[] {
  const items: FeedItem[] = [...listedArticles().map(articleItem), ...allPapers().map(paperItem)];
  for (const r of libraryItems()) {
    if (r.kind !== "Research" || r.shelf === "investigation" || !r.doc) continue;
    const d = researchDoc(r.doc);
    if (!d) continue;
    items.push({
      url: `${SITE}/p/${d.id}`,
      title: r.title,
      summary: r.dek,
      html: "",
      date: r.date,
      topic: r.topic,
      kind: "Research",
    });
  }
  const wanted = new Set(topics);
  const list = items
    .filter((i) => !wanted.size || wanted.has(i.topic))
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title))
    .slice(0, MAX_ITEMS);
  // Research bodies are rendered only for the items that made the cut.
  for (const i of list) {
    if (i.kind === "Research" && !i.html) {
      const d = researchDoc(i.url.slice(`${SITE}/p/`.length));
      i.html = d ? absolute(documentHtml(d.body).html) : "";
    }
  }
  return list;
}

/** Topic names from a "?t=a,b" list of slugs (or names). */
export function topicsFromParam(t: string | undefined): string[] {
  if (!t) return [];
  const bySlug = new Map(libraryItems().map((r) => [topicSlug(r.topic), r.topic]));
  return t
    .split(",")
    .map((s) => bySlug.get(topicSlug(s.trim())))
    .filter((x): x is string => !!x);
}

const rfc822 = (iso: string) => new Date(`${iso}T15:00:00Z`).toUTCString();

export function rssFeed(items: FeedItem[], self: string, title = "Canopticon"): string {
  const cdata = (s: string) => `<![CDATA[${s.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
<title>${esc(title)}</title>
<link>${SITE}/</link>
<description>${esc(DESCRIPTION)}</description>
<language>en-ca</language>
<atom:link rel="self" type="application/rss+xml" href="${esc(self)}"/>
<atom:link rel="hub" href="${HUB}"/>
${items[0] ? `<lastBuildDate>${rfc822(items[0].date)}</lastBuildDate>\n` : ""}${items
  .map(
    (i) => `<item>
<title>${esc(i.title)}</title>
<link>${esc(i.url)}</link>
<guid isPermaLink="true">${esc(i.url)}</guid>
<pubDate>${rfc822(i.date)}</pubDate>
<dc:creator>Chris Telford</dc:creator>
<category>${esc(i.topic)}</category>
<category>${esc(i.kind)}</category>
<description>${esc(i.summary)}</description>
<content:encoded>${cdata(i.html)}</content:encoded>
</item>`,
  )
  .join("\n")}
</channel>
</rss>
`;
}

export function jsonFeed(items: FeedItem[], self: string, title = "Canopticon"): string {
  return JSON.stringify({
    version: "https://jsonfeed.org/version/1.1",
    title,
    home_page_url: `${SITE}/`,
    feed_url: self,
    description: DESCRIPTION,
    language: "en-CA",
    authors: [{ name: "Chris Telford", url: `${SITE}/about` }],
    hubs: [{ type: "WebSub", url: HUB }],
    items: items.map((i) => ({
      id: i.url,
      url: i.url,
      title: i.title,
      summary: i.summary,
      content_html: i.html,
      date_published: `${i.date}T15:00:00Z`,
      tags: [i.topic, i.kind],
    })),
  });
}

/** WebSub discovery on the response itself, as well as in the body. */
export function feedHeaders(contentType: string, self: string): Record<string, string> {
  return {
    "content-type": contentType,
    "cache-control": "public, max-age=900",
    link: `<${HUB}>; rel="hub", <${self}>; rel="self"`,
  };
}

// ---- llms.txt ---------------------------------------------------------------

const oneLine = (s: string, n = 180) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

/** H1, a summary blockquote, the feeds, then one H2 per topic listing every
 *  public document with a one-line description (BACKEND.md). */
export function llmsTxt(): string {
  const rows = libraryItems().filter((r) => r.kind !== "Project");
  const byTopic = new Map<string, typeof rows>();
  for (const r of rows) {
    const t = r.shelf === "investigation" ? "Investigations" : r.topic || "Other";
    byTopic.set(t, [...(byTopic.get(t) ?? []), r]);
  }
  const order = [...byTopic].sort(
    (a, b) =>
      Number(a[0] === "Investigations") - Number(b[0] === "Investigations") ||
      b[1].length - a[1].length,
  );
  const out = [
    "# Canopticon",
    "",
    "> Questions researched in depth, and articles written from what the research found. Every quote in an article links to the stored research document it came from. By Chris Telford. Licensed CC BY 4.0.",
    "",
    `Feeds: ${SITE}/feed.xml (RSS), ${SITE}/feed.json (JSON Feed). Per-topic feeds live under ${SITE}/feeds/. Every document has a Markdown twin: add .md to its address. Full text of every article: ${SITE}/llms-full.txt`,
    "",
  ];
  for (const [topic, list] of order) {
    out.push(`## ${topic}`, "");
    for (const r of list.sort((a, b) => b.date.localeCompare(a.date))) {
      out.push(
        `- [${r.title.replace(/[[\]]/g, "")}](${SITE}${r.route}): ${oneLine(r.dek || r.kind)}`,
      );
    }
    out.push("");
  }
  return out.join("\n");
}

/** Every article and paper, whole, as Markdown — quotes kept as the essay
 *  contract writes them, so a machine can check each one against its source. */
export function llmsFullTxt(): string {
  const parts = [
    "# Canopticon — every article and paper, in full",
    "",
    '> By Chris Telford. CC BY 4.0. In articles, text inside <q doc="…"> is a verbatim quotation from the research document at https://canopticon.com/p/<doc>; everything else is the author\'s own.',
    "",
  ];
  for (const a of listedArticles()) {
    parts.push(
      "---",
      "",
      `# ${a.title}`,
      "",
      `URL: ${SITE}/articles/${a.slug} · ${a.date} · ${topicOf(a)}`,
      "",
      a.thesis ? `Thesis: ${a.thesis}\n` : "",
      a.body.trim(),
      "",
    );
  }
  for (const p of allPapers()) {
    parts.push("---", "", `URL: ${SITE}/articles/${p.slug} · ${p.date}`, "", p.body.trim(), "");
  }
  return parts.join("\n");
}
