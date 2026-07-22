// FAQ / Q&A hub — `/f/:slug`.
//
// Question-shaped facts about the subject, rendered as a FAQPage. Data
// backing is currently thin — the extractor doesn't explicitly mark
// Q-shaped facts. This renderer surfaces facts whose label looks like a
// declarative answer to a common question (heuristic for now); when the
// extractor learns to emit FAQ-typed facts (a later refinement) this
// renderer reads them directly.

import type { PublicEnv } from "../../data";
import { all, escapeAttr, escapeHtml, loadSubject, renderArrangementStandalone } from "./shared";

interface FaqItem {
  question: string;
  answer: string;
  quote_id: string | null;
}

/** Take a fact label and try to phrase it as a Q/A pair. Falls back to
 *  "Tell me about X" → answer if no question can be derived. */
function asQA(subjectLabel: string, label: string): { question: string; answer: string } {
  const m = label.match(/^(.+?)\s+(is|was|are|were|has|have|had|does|did)\s+(.+)$/i);
  if (m) {
    const [, subj, verb, rest] = m;
    return {
      question: `${capitalise((verb ?? "is").toLowerCase())} ${subj} ${rest}?`.replace(
        /\?\?$/,
        "?",
      ),
      answer: label,
    };
  }
  return { question: `What is the documented fact about ${subjectLabel}?`, answer: label };
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

async function loadFaq(
  env: PublicEnv,
  subject: { userId: string; nodeId: string; label: string },
): Promise<FaqItem[]> {
  const rows = await all<{ label: string; quote_id: string | null }>(
    env.DB,
    `SELECT n.label,
            (SELECT id FROM quotes WHERE node_id = n.id LIMIT 1) AS quote_id
       FROM nodes n
       LEFT JOIN edges e ON (e.src_node_id = n.id AND e.dst_node_id = ? AND e.family = 'aboutness')
      WHERE n.user_id = ?
        AND n.kind = 'neutral_fact'
        AND e.id IS NOT NULL
      ORDER BY n.created_at DESC
      LIMIT 12`,
    [subject.nodeId, subject.userId],
  ).catch(() => []);
  return rows.map((r) => ({ ...asQA(subject.label, r.label), quote_id: r.quote_id }));
}

export function renderFaqBlock(items: FaqItem[]): string {
  if (items.length === 0) {
    return `<section class="faq-empty">
  <p>No question-shaped facts surfaced yet for this subject. The FAQ fills in as the extractor learns to identify answers to common questions about the subject.</p>
</section>
<style>
  .faq-empty p { font-family: var(--serif); font-size: 15px; color: var(--ink-3); font-style: italic; max-width: 640px; margin: 0; }
</style>`;
  }
  const blocks = items
    .map(
      (item) => `<div class="faq-item">
  <div class="faq-q">${escapeHtml(item.question)}</div>
  <div class="faq-a">${escapeHtml(item.answer)}${item.quote_id ? ` <a class="faq-receipt" href="/q/${escapeAttr(item.quote_id)}">↗</a>` : ""}</div>
</div>`,
    )
    .join("");
  return `<section data-schema="FAQPage">
  <div class="faq-list">${blocks}</div>
</section>
<style>
  .faq-list { display: flex; flex-direction: column; gap: 18px; }
  .faq-item {
    padding: 18px 20px;
    border: 1px solid var(--rule);
    border-radius: 9px;
    background: var(--surface, #fff);
  }
  .faq-q {
    font-family: var(--serif);
    font-size: 17px; line-height: 1.35;
    color: var(--ink);
    font-weight: 600;
    margin-bottom: 8px;
  }
  .faq-a {
    font-family: var(--serif);
    font-size: 15px; line-height: 1.55;
    color: var(--ink-2);
  }
  .faq-receipt { color: var(--accent); text-decoration: none; font-size: 12px; }
  .faq-receipt:hover { text-decoration: underline; }
</style>`;
}

export async function renderFaqPage(env: PublicEnv, slug: string): Promise<string | null> {
  const subject = await loadSubject(env, slug);
  if (!subject) return null;
  const items = await loadFaq(env, subject);
  const inner = renderFaqBlock(items);
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    name: `FAQ · ${subject.label}`,
    mainEntity: items.slice(0, 20).map((it) => ({
      "@type": "Question",
      name: it.question,
      acceptedAnswer: { "@type": "Answer", text: it.answer },
    })),
    about: { "@type": "Thing", name: subject.label },
    publisher: { "@id": "https://canopticon.com/#org" },
  }).replace(/<\/script/gi, "<\\/script");
  return renderArrangementStandalone({
    subject,
    arrangementLabel: "FAQ",
    arrangementKind: "faq",
    inner,
    jsonLd,
    title: `FAQ · ${subject.label}`,
    description: `Common questions about ${subject.label}, answered from extracted facts with receipts.`,
  });
}
