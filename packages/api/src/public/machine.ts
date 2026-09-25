// The machine-readable face of the publication.
//
// Every generator here reads the same `pieces` rows the HTML pages read, so
// the page, its structured data, its plain-text twin, the feed and llms.txt
// cannot drift apart — there is one source and five renderings of it, not
// five things to keep in sync.
//
// Nothing in this file calls a model. Structured data is derived from the
// document's own text and metadata; if it isn't in the piece, it isn't
// emitted.

import { resolveByline } from "../lib/byline";
import { TETRAD_QUADRANTS, type TetradQuadrant, parseEssay, parseTetrad } from "../lib/essay";
import { displayTitle } from "../lib/title";
import { type PieceDetail, type PublishedPieceRef, TOPIC_DESCRIPTIONS, topicSlug } from "./data";

export const SITE = "https://canopticon.com";

export const ORG = {
  "@type": "Organization",
  "@id": `${SITE}/#org`,
  name: "Canopticon",
  url: SITE,
  sameAs: ["https://x.com/canoptics", "https://github.com/crystalford/canopticon"],
} as const;

// The site entity every document is `isPartOf`. Its @id matches the one the
// front page's graph emits (siteJsonLd), so a crawler resolves ONE WebSite
// across the publication rather than a new one per page. The SearchAction is
// the answer-engine surface (/search) declared as such.
export const WEBSITE = {
  "@type": "WebSite",
  "@id": `${SITE}/#site`,
  url: `${SITE}/`,
  name: "Canopticon",
  publisher: { "@id": `${SITE}/#org` },
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE}/search?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
} as const;

/** The byline as a Person, with the one public handle the operator has. */
export function authorPerson(byline: string | null | undefined): Record<string, unknown> {
  return {
    "@type": "Person",
    name: resolveByline(byline),
    url: `${SITE}/about`,
    sameAs: ["https://twitter.com/canoptics"],
  };
}

export function sectionUrl(topic: string): string {
  return `${SITE}/research/${topicSlug(topic)}`;
}

/** Home › Research|Essays › [Section] › Title, as schema.org BreadcrumbList. */
export function breadcrumbLd(
  crumbs: Array<{ name: string; url?: string }>,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      ...(c.url ? { item: c.url } : {}),
    })),
  };
}

export const LICENSE = {
  name: "CC BY 4.0",
  url: "https://creativecommons.org/licenses/by/4.0/",
};

const ESSAY_KINDS = new Set(["essay"]);

export function pieceUrl(slug: string): string {
  return `${SITE}/p/${slug}`;
}

export function pieceMarkdownUrl(slug: string): string {
  return `${SITE}/p/${slug}.md`;
}

// The title a document publishes under. Shared with the HTML page so the
// JSON-LD headline, the markdown twin, llms.txt, the feed and the citation
// strings can never call the same document something different.
export function pieceTitle(piece: { title: string; body_md?: string | null }): string {
  return displayTitle(piece.title, piece.body_md);
}

export function isEssay(kind: string): boolean {
  return ESSAY_KINDS.has(kind);
}

function words(md: string): number {
  return md.split(/\s+/).filter(Boolean).length;
}

function dateOnly(iso: string | null | undefined): string {
  return (iso ?? "").slice(0, 10);
}

// The "## Sources" block, if the document has one. Used for `citation[]` in
// the structured data — a listed source is a claim the piece is making about
// where it got something, so it belongs in the machine face as well as the
// human one.
export function sourceLines(body_md: string): string[] {
  const lines = body_md.split("\n");
  const start = lines.findIndex((l) => /^##\s+sources?\s*$/i.test(l.trim()));
  if (start === -1) return [];
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (/^##\s+/.test(line)) break;
    const t = line.trim();
    if (!t) continue;
    out.push(t.replace(/^\d+[.)]\s*/, "").replace(/^[-*]\s*/, ""));
  }
  return out;
}

// ---- structured data ------------------------------------------------------

export interface PieceLdOptions {
  /** Approved lead passage, verbatim — see graph/lib/lede.ts. */
  lede?: string;
  /** Question/answer pairs for FAQPage, when the piece has them. */
  faq?: Array<{ question: string; answer: string; anchor: string }>;
  /**
   * The operator's readings (docs/the-record.md §5c): each a Comment whose
   * `about` is the Quotation it is anchored to. The note is the operator's
   * own words, so the author is the same Person the page's byline names.
   */
  readings?: Array<{
    id: string;
    quote_id: string;
    verbatim_text: string;
    note_md: string;
    created_at: string;
  }>;
  /** The closed section this document is filed in (graph/lib/topics.ts), for
   *  the breadcrumb trail. Null or absent when ungrouped. */
  section?: string | null;
  /** The document this one grew from (docs/the-record.md §5), for `isBasedOn`. */
  basedOn?: { slug: string; title: string } | null;
  /**
   * A tetrad (docs/the-record.md §1b): the H1 is the thing the four
   * questions are asked of (`about`), and each quadrant is a named part of
   * the page (`hasPart`). Derived from the file by essayTetradLd; no FAQ.
   */
  tetrad?: TetradLd | null;
}

export interface TetradLd {
  subject: string;
  quadrants: Array<{ quadrant: TetradQuadrant; name: string; anchor: string }>;
}

export const TETRAD_LABELS: Record<TetradQuadrant, string> = {
  enhances: "Enhances",
  obsolesces: "Obsolesces",
  retrieves: "Retrieves",
  reverses: "Reverses into",
};

/** The four quadrants as page parts, or null when the body is not a tetrad. */
export function essayTetradLd(bodyMd: string): TetradLd | null {
  const t = parseTetrad(bodyMd);
  if (!t) return null;
  return {
    subject: t.subject,
    quadrants: TETRAD_QUADRANTS.map((q) => ({
      quadrant: q,
      name: TETRAD_LABELS[q],
      anchor: `#${q}`,
    })),
  };
}

// An essay's question headings and their answer-first opening paragraphs are
// already the Q&A pairs — no model is asked to invent them, and none could
// do it more faithfully than the author's own structure.
//
// Note on FAQPage: Google deprecated FAQ rich results in 2026, so this no
// longer produces a visible SERP snippet there. It is still emitted because
// other engines and crawlers consume it, and it costs nothing.
export function essayFaq(bodyMd: string): PieceLdOptions["faq"] {
  return parseEssay(bodyMd)
    .sections.filter((s) => s.isQuestion && s.paragraphs.length)
    .map((s) => ({
      question: s.heading,
      answer: stripInline(s.paragraphs[0] ?? ""),
      anchor: `#${s.anchor}`,
    }));
}

function stripInline(md: string): string {
  return md
    .replace(/\[(\d+)\]/g, "")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// An essay is an Article; a research document is a DigitalDocument published
// as itself. Both carry citation, license and speakable — `speakable` points
// at the summary block, which is the passage written to stand alone.
export function pieceJsonLd(piece: PieceDetail, opts: PieceLdOptions = {}): string {
  return pieceJsonLdDocs(piece, opts).map(ldScript).join("\n");
}

/**
 * The same structured data as plain objects, one per `<script>` block —
 * the document model (public/models/document.ts) carries these so the JSON
 * face and the HTML face are built from one object, never two.
 */
export function pieceJsonLdDocs(piece: PieceDetail, opts: PieceLdOptions = {}): unknown[] {
  const url = pieceUrl(piece.slug);
  const published = dateOnly(piece.published_at ?? piece.created_at);
  const modified = dateOnly(piece.updated_at ?? piece.published_at ?? piece.created_at);
  const citations = sourceLines(piece.body_md ?? "");
  const essay = isEssay(piece.kind);

  const base: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": essay ? "Article" : "DigitalDocument",
    name: pieceTitle(piece),
    headline: pieceTitle(piece),
    url,
    inLanguage: "en",
    isAccessibleForFree: true,
    license: LICENSE.url,
    publisher: ORG,
    // The SAME name the page shows. These drifted once: the visible byline was
    // repaired to a real person while this kept emitting the stored
    // placeholder ("the operator") or fell back to the organisation — and a
    // named Person here is the half a crawler actually parses, which is where
    // the authorship citation signal lives.
    author: authorPerson(piece.byline),
    isPartOf: WEBSITE,
    datePublished: published,
    dateModified: modified,
    wordCount: words(piece.body_md ?? ""),
    encoding: {
      "@type": "MediaObject",
      encodingFormat: "text/markdown",
      contentUrl: pieceMarkdownUrl(piece.slug),
    },
  };
  if (piece.subtitle) base.description = piece.subtitle;
  // `abstract` is the passage this document wants lifted, when one has been
  // selected and approved. Verbatim from the document, so it agrees exactly
  // with what a crawler finds on the page rather than paraphrasing it.
  if (opts.lede) base.abstract = opts.lede;
  if (citations.length) base.citation = citations;
  if (opts.basedOn) {
    base.isBasedOn = {
      "@type": "DigitalDocument",
      "@id": pieceUrl(opts.basedOn.slug),
      name: opts.basedOn.title,
      url: pieceUrl(opts.basedOn.slug),
    };
  }
  if (opts.readings?.length) {
    // Name only: the document's top-level `author` carries the full Person
    // (url, sameAs); a Comment's author needs only to resolve to the same name.
    const author = { "@type": "Person", name: resolveByline(piece.byline) };
    base.comment = opts.readings.map((r) => ({
      "@type": "Comment",
      "@id": `${url}#reading-${r.id}`,
      text: r.note_md,
      dateCreated: dateOnly(r.created_at),
      author,
      about: {
        "@type": "Quotation",
        text: r.verbatim_text,
        url: `${SITE}/q/${r.quote_id}`,
        isPartOf: { "@type": essay ? "Article" : "DigitalDocument", "@id": url },
      },
    }));
    base.commentCount = opts.readings.length;
  }
  if (opts.tetrad) {
    base.about = [{ "@type": "Thing", name: opts.tetrad.subject }];
    base.hasPart = opts.tetrad.quadrants.map((q) => ({
      "@type": "WebPageElement",
      name: q.name,
      cssSelector: `.tetrad-cell${q.anchor}`,
      url: `${url}${q.anchor}`,
    }));
  }
  if (essay) {
    base.speakable = {
      "@type": "SpeakableSpecification",
      cssSelector: [".tldr", ".reading h2", ".reading p.lead"],
    };
  }

  const docs: unknown[] = [base];
  // The same trail the page shows above the title. The section crumb is
  // present only when the document has been filed (a hub URL that exists).
  docs.push(
    breadcrumbLd([
      { name: "Home", url: `${SITE}/` },
      essay
        ? { name: "Essays", url: `${SITE}/essays` }
        : { name: "Research", url: `${SITE}/research` },
      ...(!essay && opts.section ? [{ name: opts.section, url: sectionUrl(opts.section) }] : []),
      { name: pieceTitle(piece) },
    ]),
  );
  if (opts.faq?.length) {
    docs.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: opts.faq.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer, url: `${url}${f.anchor}` },
      })),
    });
  }
  return docs;
}

// Site-level identity, emitted once on the front page. The @id values are
// what every other document's `publisher` can point at, so search engines
// resolve one organisation rather than a new one per page.
//
// Ported from the old graph-era home page, which is the only place it lived;
// its description still called this "a forensic intelligence publication
// system ... a typed graph of verified facts", which describes the product
// this stopped being.
export function siteJsonLd(): string {
  return ldScript({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE}/#site`,
        url: `${SITE}/`,
        name: "Canopticon",
        description:
          "Research documents published as themselves, and essays that argue from them. Quotes are verified word-for-word against the stored source. CC BY 4.0.",
        publisher: { "@id": `${SITE}/#org` },
      },
      ORG,
    ],
  });
}

/** CollectionPage + BreadcrumbList for a section hub. */
export function sectionJsonLd(
  topic: string,
  docs: Array<{ slug: string; title: string; body_head?: string | null }>,
): string {
  const url = sectionUrl(topic);
  return [
    ldScript({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": url,
      url,
      name: topic,
      description: TOPIC_DESCRIPTIONS[topic as keyof typeof TOPIC_DESCRIPTIONS] ?? "",
      inLanguage: "en",
      isPartOf: WEBSITE,
      publisher: ORG,
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: docs.length,
        itemListElement: docs.map((d, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: pieceUrl(d.slug),
          name: displayTitle(d.title, d.body_head),
        })),
      },
    }),
    ldScript(
      breadcrumbLd([
        { name: "Home", url: `${SITE}/` },
        { name: "Research", url: `${SITE}/research` },
        { name: topic },
      ]),
    ),
  ].join("\n");
}

// Matches the escaping already used by arrangements/shared.ts: the only
// sequence that can break out of a JSON-LD script block is `</script`.
export function ldScript(doc: unknown): string {
  const json = JSON.stringify(doc).replace(/<\/script/gi, "<\\/script");
  return `<script type="application/ld+json">${json}</script>`;
}

// ---- citations ------------------------------------------------------------

export function citeApa(piece: PieceDetail): string {
  const year = dateOnly(piece.published_at ?? piece.created_at).slice(0, 4) || "n.d.";
  const author = piece.byline || "Canopticon";
  return `${author}. (${year}). ${pieceTitle(piece)}. Canopticon. ${pieceUrl(piece.slug)}`;
}

export function citeBibtex(piece: PieceDetail): string {
  const year = dateOnly(piece.published_at ?? piece.created_at).slice(0, 4) || "n.d.";
  const author = piece.byline || "Canopticon";
  return [
    `@misc{canopticon-${piece.slug},`,
    `  title        = {${pieceTitle(piece)}},`,
    `  author       = {${author}},`,
    `  year         = {${year}},`,
    `  howpublished = {\\url{${pieceUrl(piece.slug)}}},`,
    `  note         = {Canopticon. ${LICENSE.name}}`,
    "}",
  ].join("\n");
}

// ---- the plain-text twin --------------------------------------------------

// The same document a reader sees, as text: a short provenance header then
// the body verbatim. `body_md` is already markdown — this adds the framing a
// crawler needs to know what it is holding and where it came from.
export function pieceMarkdown(piece: PieceDetail): string {
  const published = dateOnly(piece.published_at ?? piece.created_at);
  const modified = dateOnly(piece.updated_at ?? piece.published_at ?? piece.created_at);
  const head = [
    `# ${pieceTitle(piece)}`,
    "",
    piece.subtitle ? `> ${piece.subtitle}\n` : "",
    `${isEssay(piece.kind) ? "Essay" : "Research document"} · Canopticon · published ${published}${
      modified && modified !== published ? ` · updated ${modified}` : ""
    }`,
    `Canonical: ${pieceUrl(piece.slug)}`,
    `License: ${LICENSE.name} (${LICENSE.url})`,
    "",
    "---",
    "",
  ]
    .filter((l) => l !== "")
    .join("\n");
  return `${head}\n${piece.body_md ?? ""}\n`;
}

// ---- index files ----------------------------------------------------------

type LlmsEntry = PublishedPieceRef;

export interface AnswerEntry {
  question: string;
  slug: string;
}

export function llmsTxt(entries: LlmsEntry[], sections: string[] = []): string {
  const essays = entries.filter((e) => isEssay(e.kind));
  const research = entries.filter((e) => !isEssay(e.kind));
  const line = (e: LlmsEntry) =>
    `- [${displayTitle(e.title, e.body_head)}](${pieceMarkdownUrl(e.slug)})${e.subtitle ? `: ${e.subtitle}` : ""}`;

  const parts = [
    "# Canopticon",
    "",
    "> A public record: primary research documents published as themselves, and essays",
    "> that argue from them. Quotes drawn from stored documents are verified word-for-word",
    "> against the source on file. Everything is CC BY 4.0 — citation is the point.",
    "",
  ];
  if (essays.length) {
    parts.push("## Essays", "", ...essays.map(line), "");
  }
  if (research.length) {
    parts.push("## Research", "", ...research.map(line), "");
  }
  // Only sections that hold a document — an empty hub is not announced.
  if (sections.length) {
    parts.push(
      "## Sections",
      "",
      ...sections.map(
        (t) =>
          `- [${t}](${sectionUrl(t)}): ${TOPIC_DESCRIPTIONS[t as keyof typeof TOPIC_DESCRIPTIONS] ?? ""}`,
      ),
      "",
    );
  }
  parts.push(
    "## Optional",
    "",
    `- [Every document in full, one file](${SITE}/llms-full.txt)`,
    `- [About and editorial standards](${SITE}/about)`,
    `- [How verification works](${SITE}/method)`,
    `- [Sitemap](${SITE}/sitemap.xml)`,
    `- [Feed](${SITE}/feed.json)`,
    "",
  );
  return parts.join("\n");
}

/**
 * /llms-full.txt — every published document's markdown twin, concatenated.
 * The same pieceMarkdown() each twin is served from, so the two cannot differ;
 * a header line per document names it, its canonical URL and its date.
 */
export function llmsFullTxt(pieces: PieceDetail[]): string {
  const head = [
    "# Canopticon — full text",
    "",
    `> Every published document, in full, as plain text. ${pieces.length} document${
      pieces.length === 1 ? "" : "s"
    }. Each begins with its title, canonical URL and date; the index is at ${SITE}/llms.txt.`,
    "",
  ].join("\n");
  const docs = pieces.map((p) => {
    const published = dateOnly(p.published_at ?? p.created_at);
    return [
      `<!-- ${pieceTitle(p)} · ${pieceUrl(p.slug)} · ${published || "date unknown"} -->`,
      "",
      pieceMarkdown(p).trimEnd(),
    ].join("\n");
  });
  return `${[head, ...docs].join("\n\n---\n\n")}\n`;
}

export function feedJson(entries: LlmsEntry[]): string {
  const items = entries.map((e) => {
    const published = dateOnly(e.published_at ?? e.updated_at);
    return {
      id: pieceUrl(e.slug),
      url: pieceUrl(e.slug),
      title: displayTitle(e.title, e.body_head),
      ...(e.subtitle ? { summary: e.subtitle } : {}),
      date_published: `${published}T00:00:00Z`,
      date_modified: `${dateOnly(e.updated_at)}T00:00:00Z`,
      _canopticon: {
        kind: isEssay(e.kind) ? "essay" : "research",
        markdown: pieceMarkdownUrl(e.slug),
      },
    };
  });
  return `${JSON.stringify(
    {
      version: "https://jsonfeed.org/version/1.1",
      title: "Canopticon",
      home_page_url: SITE,
      feed_url: `${SITE}/feed.json`,
      description: "Research documents published as themselves, and essays that argue from them.",
      language: "en",
      items,
    },
    null,
    2,
  )}\n`;
}
