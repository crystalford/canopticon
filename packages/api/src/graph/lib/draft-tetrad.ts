// A MODEL-DRAFTED TETRAD from a document, CLEARLY LABELLED as such.
//
// McLuhan's four questions (docs/the-record.md §1b) asked of the subject of
// one document in the record. The rule is the one the operator chose for
// essays: a model may DRAFT, the draft is a labelled file the operator
// rewrites and uploads under their own name, and nothing is stored — no row,
// no publish, no byline. The result is a `.md` in the tetrad shape
// (lib/essay.ts: looksLikeTetrad / parseTetrad), which is exactly what the
// upload classifier recognises, so the file the operator hands back renders
// as the 2×2 grid without anyone touching a template.
//
// Two checks run on the draft before it is handed over, and both are
// reported IN the file rather than trusted:
//
//   · Shape — parseTetrad. A draft that is not four quadrants gets a second
//     label line saying so; the raw text is still returned, because a nearly
//     right draft is worth more than a 500.
//   · Quotations — every "…" span over 40 characters is located verbatim in
//     the document by locateVerbatim (rule 1: verification is mechanical).
//     The ones that are not found are marked ⚠ inline and counted in a label
//     line, so the operator reads the draft knowing which sentences the
//     record vouches for and which the model made up.
//
// The writer is asked once, with the document's summary and up to twelve
// verified passages, and told that any quotation must be one of them.

import type { Env } from "../../env";
import { all, one } from "../../lib/d1";
import { parseTetrad } from "../../lib/essay";
import { callResearchWriter } from "../../llm/router";
import { locateVerbatim } from "./digestion-typed";
import { ledeForPiece } from "./lede";

/** Verified passages offered to the writer, at most. */
export const MAX_TETRAD_PASSAGES = 12;
/** How much of the document the writer sees when there is no lead passage. */
export const SUMMARY_CHARS = 1500;
/** A "…" span shorter than this is a phrase, not a quotation to verify. */
export const MIN_QUOTATION_CHARS = 40;

export type DraftTetradResult =
  | {
      ok: true;
      markdown: string;
      filename: string;
      /** True when parseTetrad accepted the writer's output. */
      parsed: boolean;
      /** Quoted spans over MIN_QUOTATION_CHARS found in the draft. */
      checked: number;
      /** Of those, the ones not located verbatim in the document (marked ⚠). */
      failed: number;
    }
  | { ok: false; reason: string };

interface PieceRow {
  id: string;
  slug: string;
  title: string;
  body_md: string | null;
}

/** Straight and curly double quotes, either side; the span is group 2. */
const QUOTATION_RE = /(["“])([^"“”\n]{8,})(["”])/g;

/**
 * Mark every quoted span over MIN_QUOTATION_CHARS that is not verbatim in
 * `bodyMd` with ⚠, and count both sides. Pure, so the test can pin it.
 */
export function checkQuotations(
  draft: string,
  bodyMd: string,
): { text: string; checked: number; failed: number } {
  let checked = 0;
  let failed = 0;
  const text = draft.replace(QUOTATION_RE, (whole, open: string, span: string, close: string) => {
    if (span.trim().length <= MIN_QUOTATION_CHARS) return whole;
    checked++;
    if (locateVerbatim(bodyMd, span)) return whole;
    failed++;
    return `${open}${span}${close} ⚠`;
  });
  return { text, checked, failed };
}

/** Strip a code fence the model may have wrapped the file in. */
function unfence(text: string): string {
  return text
    .trim()
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/\n?```$/, "")
    .trim();
}

export async function draftTetrad(
  env: Env,
  userId: string,
  pieceId: string,
  opts: { writer?: string | null } = {},
): Promise<DraftTetradResult> {
  const piece = await one<PieceRow>(
    env.DB,
    `SELECT id, slug, title, body_md FROM pieces
      WHERE id = ? AND user_id = ? AND publication_status IN ('published', 'working-material')`,
    [pieceId, userId],
  );
  if (!piece) return { ok: false, reason: "no such document" };
  const bodyMd = piece.body_md ?? "";
  if (!bodyMd.trim()) return { ok: false, reason: "document has no text" };

  // The summary the writer reads: the lead passage when the pipeline has
  // chosen one (selected verbatim, never composed), the document's opening
  // otherwise. Both are the document's own words.
  const lede = await ledeForPiece(env.DB, userId, pieceId).catch(() => null);
  const summary = lede?.verbatim_text?.trim() || bodyMd.slice(0, SUMMARY_CHARS).trim();

  // Verified passages: every quotes row whose source node is this document
  // (readings' passages are on the same node), longest first.
  const passages = await all<{ verbatim_text: string }>(
    env.DB,
    `SELECT q.verbatim_text
       FROM quotes q JOIN nodes n ON n.id = q.source_id
      WHERE n.piece_id = ? AND q.user_id = ?
      ORDER BY length(q.verbatim_text) DESC
      LIMIT ?`,
    [pieceId, userId, MAX_TETRAD_PASSAGES],
  ).catch(() => []);
  const passageLines = passages.map((p) => `- "${p.verbatim_text.replace(/\s+/g, " ").trim()}"`);
  const url = `https://canopticon.com/p/${piece.slug}`;

  const out = await callResearchWriter(
    env,
    {
      userId,
      system: [
        "You draft McLuhan tetrads for a research publication. Write in Markdown, in exactly this shape and nothing else:",
        "",
        "# Title",
        "A one-line dek.",
        "",
        "A short summary paragraph that stands alone.",
        "",
        "## Enhances",
        "Two to four sentences.",
        "",
        "## Obsolesces",
        "Two to four sentences.",
        "",
        "## Retrieves",
        "Two to four sentences.",
        "",
        "## Reverses into",
        "Two to four sentences.",
        "",
        "## Sources",
        "1. The document, by title and URL.",
        "",
        "Rules: the four ## headings are exactly Enhances, Obsolesces, Retrieves, Reverses into — no others besides Sources.",
        "The tetrad is asked of the document's SUBJECT (the medium, artefact or idea it is about), not of the document.",
        "Any quotation in double quotes must be one of the verified passages supplied, word for word; otherwise do not quote — paraphrase.",
        "Do not invent figures. Do not include any preamble or commentary outside the tetrad.",
      ].join("\n"),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                `Document: "${piece.title}" (source 1: Canopticon, ${url})`,
                "",
                "The document's summary:",
                summary,
                "",
                passageLines.length
                  ? `Verified passages from the document (the only text you may quote):\n${passageLines.join("\n")}`
                  : "The document has no verified passages yet; quote nothing.",
              ].join("\n"),
            },
          ],
        },
      ],
      max_tokens: 1500,
      idempotency_key: `${pieceId}:draft-tetrad:${Date.now()}`,
    },
    { writer: opts.writer ?? null },
  );

  const raw = unfence(out.text);
  const parsed = parseTetrad(raw) !== null;
  const { text: body, checked, failed } = checkQuotations(raw, bodyMd);
  const date = new Date().toISOString().slice(0, 10);
  const labels = [
    `<!-- DRAFTED BY ${out.model} as a tetrad from "${piece.title}" (${url}) on ${date}. Not published. Edit before uploading; the byline will be yours. -->`,
  ];
  if (!parsed) {
    labels.push(
      "<!-- This draft did not parse as a tetrad; fix the four headings before uploading. -->",
    );
  }
  labels.push(
    `<!-- ${checked} quotation${checked === 1 ? "" : "s"} checked against the document; ${failed} not found verbatim${failed ? " (marked ⚠ in the text)" : ""}. -->`,
  );
  return {
    ok: true,
    markdown: `${labels.join("\n")}\n\n${body}\n`,
    filename: `tetrad-draft-${piece.slug}.md`,
    parsed,
    checked,
    failed,
  };
}
