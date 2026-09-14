// Answer pages — the citable pillars.
//
// One page per question, and a question is shared across documents rather than
// duplicated per document. Three reports answering "how much did federal
// transfers grow in 2025–26?" produce ONE page carrying three sources, not
// three pages competing with each other. Google's generative-retrieval patents
// include domain diversity, so a site's own near-duplicates displace one
// another; merging is what lets the corpus compound as documents are added.
//
// The page shape follows what the evidence supports: the question as the H1,
// the answer first, then the verbatim spans with attribution. Retrieval is
// passage-level, so the passage a crawler lifts should be the answer itself,
// sitting near the top and complete on its own.
//
// No QAPage markup — that type requires user-submitted answers, and using it
// for authored Q&A misuses the spec. No FAQPage either; rich results for it
// were removed in 2026. The controlled evidence says structured data moves
// citations by roughly nothing, so the shape of the page is doing the work.

import {
  type AnswerEvidence,
  evidenceForQuestion,
  getQuestionBySlug,
  listPublishedQuestions,
} from "../../graph/lib/aeo-extract";
import { countWords, gateQuestion } from "../../lib/aeo";
import { displayTitle } from "../../lib/title";
import { type PublicEnv, resolveOperatorId } from "../data";
import { escapeAttr, escapeHtml, renderPage } from "../layout";
import { ldScript } from "../machine";
import { emptyState } from "./components";

const CANONICAL = "https://canopticon.com";

export function answerUrl(slug: string): string {
  return `${CANONICAL}/answers/${slug}`;
}

export async function renderAnswersIndex(env: PublicEnv): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const questions = userId ? await listPublishedQuestions(env.DB, userId) : [];
  const body = `<header class="phead">
  <div class="eyebrow">Answers</div>
  <h1>Questions the record answers</h1>
  <p class="phead-dek">Each one answered with a quote checked word-for-word against a
  document on file. Where several documents answer the same question, they all appear
  on the one page.</p>
</header>
${
  questions.length
    ? `<div class="tbl">${questions
        .map(
          (q) => `<a class="row row-q" href="/answers/${escapeAttr(q.slug)}">
  <div class="row-main"><div class="row-title">${escapeHtml(q.question)}</div></div>
</a>`,
        )
        .join("\n")}</div>`
    : emptyState("No answers published yet.")
}`;
  return renderPage({
    title: "Answers",
    description:
      "Questions answered from Canopticon's research documents, each with a quote verified word-for-word against its source.",
    body,
    activeNav: "/answers",
    zone: "answers",
    canonical: `${CANONICAL}/answers`,
  });
}

function evidenceBlock(e: AnswerEvidence): string {
  const title = displayTitle(e.piece_title, e.body_head);
  return `<figure class="ev">
  <blockquote>${escapeHtml(e.answer_text)}</blockquote>
  <figcaption>
    <a href="/p/${escapeAttr(e.piece_slug)}">${escapeHtml(title)}</a>
    <span class="sep">·</span>
    <a href="/q/${escapeAttr(e.quote_id)}" class="ev-receipt">verified quote ↗</a>
  </figcaption>
</figure>`;
}

export async function renderAnswerPage(env: PublicEnv, slug: string): Promise<string | null> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId) return null;
  const q = await getQuestionBySlug(env.DB, userId, slug);
  // A proposed question has no public page. The gate is the point: a thin atom
  // must never acquire a URL, because scaled-content enforcement lands on the
  // whole domain rather than the individual page.
  if (!q || q.status !== "published") return null;

  const evidence = await evidenceForQuestion(env.DB, userId, q.id);
  // The gate again, on the evidence that will actually appear. `status` records
  // what cleared the gate when the operator published it; this checks what is
  // true now. The two diverge whenever a source document is unpublished or
  // re-extracted, and the render is the last place to catch it before a thin
  // page is served.
  if (
    !gateQuestion({
      evidenceCount: evidence.length,
      answerWords: evidence.reduce((n, e) => n + countWords(e.answer_text), 0),
    }).publishable
  ) {
    return null;
  }

  // The answer-first block: the longest verified span, stated before anything
  // else on the page. This is the passage a retriever is most likely to lift.
  const lead = evidence.reduce((a, b) => (b.answer_text.length > a.answer_text.length ? b : a));
  const sources = [...new Set(evidence.map((e) => e.piece_slug))].length;

  const body = `<div class="container reading answer">
  <div class="scope crumbs">
    <a href="/">Home</a><span class="arr">›</span>
    <a href="/answers">Answers</a>
  </div>
  <header class="page-head">
    <div class="zone-label">Answer</div>
    <h1>${escapeHtml(q.question)}</h1>
  </header>

  <div class="tldr">
    <div class="tldr-k">In short</div>
    <p>${escapeHtml(lead.answer_text)}</p>
  </div>

  <section class="sec" style="max-width:none">
    <h2>What the documents say</h2>
    ${evidence.map(evidenceBlock).join("\n    ")}
  </section>

  <p class="note" style="margin-top:26px">Answered from ${sources} document${sources === 1 ? "" : "s"} on file.
  Every quote above is checked as a literal substring of its source; quotes that fail
  are removed. <a href="/method">How verification works →</a></p>
</div>
${ldScript({
  "@context": "https://schema.org",
  "@type": "Article",
  headline: q.question,
  url: answerUrl(q.slug),
  inLanguage: "en",
  isAccessibleForFree: true,
  license: "https://creativecommons.org/licenses/by/4.0/",
  publisher: { "@id": `${CANONICAL}/#org` },
  citation: evidence.map((e) => displayTitle(e.piece_title, e.body_head)),
})}`;

  return renderPage({
    title: q.question,
    description: lead.answer_text.slice(0, 200),
    body,
    activeNav: "/answers",
    zone: "answers",
    canonical: answerUrl(q.slug),
    ogType: "article",
    bare: true,
  });
}
