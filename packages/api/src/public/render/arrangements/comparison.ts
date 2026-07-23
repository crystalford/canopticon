// Comparison matrix — `/c/:slug`.
//
// Compare a subject's stated rationale against the documented effect, or
// two subjects against each other. The structural shape needs a SECOND
// dimension (rationale-vs-effect, or subject-A-vs-subject-B) that the
// graph doesn't tag explicitly today. Renders honest empty state until
// a comparison source is identified for the subject; the JSON-LD scaffold
// is in place so search engines see what kind of page this is.

import type { PublicEnv } from "../../data";
import { escapeHtml, loadSubject, renderArrangementStandalone } from "./shared";

export function renderComparisonBlock(subjectLabel: string): string {
  return `<section class="cmp-empty">
  <p>No structured comparison yet for <b>${escapeHtml(subjectLabel)}</b>. A comparison arrangement needs an axis — stated rationale vs documented effect, or this subject vs another — that the corpus doesn't yet tag explicitly. As that gets surfaced (by either the extractor or operator markup), the matrix renders here.</p>
  <p class="cmp-meta">Schema.org Table is in place on this URL so AI engines see the page kind; the rows fill in as the comparison axis is identified.</p>
</section>
<style>
  .cmp-empty { max-width: 640px; }
  .cmp-empty p {
    font-family: var(--serif);
    font-size: 15.5px; line-height: 1.6;
    color: var(--ink-3);
    font-style: italic;
    margin: 0 0 12px;
  }
  .cmp-empty p b { color: var(--ink-2); font-style: normal; font-weight: 600; }
  .cmp-meta { font-size: 13px; color: var(--ink-3); }
</style>`;
}

export async function renderComparisonPage(env: PublicEnv, slug: string): Promise<string | null> {
  const subject = await loadSubject(env, slug);
  if (!subject) return null;
  const inner = renderComparisonBlock(subject.label);
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Table",
    name: `Comparison · ${subject.label}`,
    description: `Comparison matrix for ${subject.label} — rendered when a comparison axis is identified.`,
    about: { "@type": "Thing", name: subject.label },
    publisher: { "@id": "https://canopticon.com/#org" },
  }).replace(/<\/script/gi, "<\\/script");
  return renderArrangementStandalone({
    subject,
    arrangementLabel: "Comparison",
    arrangementKind: "comparison",
    inner,
    jsonLd,
    title: `Comparison · ${subject.label}`,
    description: `Comparison matrix for ${subject.label}.`,
  });
}
