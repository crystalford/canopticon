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
import { parseEssay } from "../lib/essay";
import { displayTitle } from "../lib/title";
import type { PieceDetail, PublishedPieceRef } from "./data";

export const SITE = "https://canopticon.com";

export const ORG = {
  "@type": "Organization",
  name: "Canopticon",
  url: SITE,
  sameAs: ["https://x.com/canoptics", "https://github.com/crystalford/canopticon"],
} as const;

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
    author: { "@type": "Person", name: resolveByline(piece.byline) },
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
  if (essay) {
    base.speakable = {
      "@type": "SpeakableSpecification",
      cssSelector: [".tldr", ".reading h2", ".reading p.lead"],
    };
  }

  const docs: unknown[] = [base];
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
  return docs.map(ldScript).join("\n");
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
      { ...ORG, "@id": `${SITE}/#org` },
    ],
  });
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

export function llmsTxt(entries: LlmsEntry[]): string {
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
  parts.push(
    "## Optional",
    "",
    `- [About and editorial standards](${SITE}/about)`,
    `- [How verification works](${SITE}/method)`,
    `- [Sitemap](${SITE}/sitemap.xml)`,
    `- [Feed](${SITE}/feed.json)`,
    "",
  );
  return parts.join("\n");
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
