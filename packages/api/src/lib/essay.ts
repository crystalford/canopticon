// The essay convention.
//
// An essay is written as plain Markdown and uploaded like any other document.
// There is no editor, and nothing here calls a model: the structure of the
// file IS the structure of the published page, and the table of contents,
// the section anchors, the FAQ structured data and the citation list all
// fall out of it deterministically.
//
//     # Title
//     A one-line dek.
//
//     A summary paragraph that stands alone — the passage answer engines
//     quote most often, and the `speakable` target in the page's JSON-LD.
//
//     ## A question ending in a question mark?
//     The answer, in the first sentence or two.
//     Supporting paragraphs after that.
//
//     ## Sources
//     1. Author. Title. Publisher, 2026.
//
// The rules, stated once:
//   · `# Title` is the title (the extractor already derives it this way).
//   · Everything between the title and the first `##` is the preamble. If it
//     has two or more paragraphs the first is the dek and the rest are the
//     summary; a single paragraph is the summary.
//   · Each `##` starts a section. Sections get anchors s1, s2, … in order.
//   · A `## Sources` heading ends the body and starts the source list.
//   · Only sections whose heading ends in "?" become FAQ entries, because
//     only those carry the question-and-answer contract.

export interface EssaySection {
  heading: string;
  /** s1, s2, … — stable across renders because it is positional. */
  anchor: string;
  /** True when the heading is a question, i.e. eligible for FAQ markup. */
  isQuestion: boolean;
  paragraphs: string[];
}

export interface ParsedEssay {
  title: string;
  dek: string;
  summary: string;
  sections: EssaySection[];
  sources: string[];
}

const SOURCES_HEADING = /^sources?$/i;

function paragraphsOf(lines: string[]): string[] {
  const out: string[] = [];
  let buf: string[] = [];
  for (const line of lines) {
    if (line.trim()) {
      buf.push(line.trim());
    } else if (buf.length) {
      out.push(buf.join(" "));
      buf = [];
    }
  }
  if (buf.length) out.push(buf.join(" "));
  return out;
}

export function parseEssay(bodyMd: string): ParsedEssay {
  const lines = (bodyMd ?? "").replace(/\r/g, "").split("\n");
  let title = "";
  const preamble: string[] = [];
  const sections: EssaySection[] = [];
  const sourceLines: string[] = [];
  let current: { heading: string; lines: string[] } | null = null;
  let inSources = false;

  for (const line of lines) {
    const h1 = line.match(/^#\s+(.+?)\s*$/);
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h1 && !title && !current) {
      title = h1[1] ?? "";
      continue;
    }
    if (h2) {
      if (current) sections.push(toSection(current, sections.length));
      const heading = h2[1] ?? "";
      if (SOURCES_HEADING.test(heading.trim())) {
        current = null;
        inSources = true;
        continue;
      }
      inSources = false;
      current = { heading, lines: [] };
      continue;
    }
    if (inSources) {
      const t = line.trim();
      if (t) sourceLines.push(t.replace(/^\d+[.)]\s*/, "").replace(/^[-*]\s+/, ""));
      continue;
    }
    if (current) current.lines.push(line);
    else preamble.push(line);
  }
  if (current) sections.push(toSection(current, sections.length));

  const preParas = paragraphsOf(preamble);
  const dek = preParas.length > 1 ? (preParas[0] ?? "") : "";
  const summary = (preParas.length > 1 ? preParas.slice(1) : preParas).join(" ");

  return { title, dek, summary, sections, sources: sourceLines };
}

function toSection(raw: { heading: string; lines: string[] }, index: number): EssaySection {
  return {
    heading: raw.heading,
    anchor: `s${index + 1}`,
    isQuestion: raw.heading.trim().endsWith("?"),
    paragraphs: paragraphsOf(raw.lines),
  };
}

// Is this uploaded markdown an essay rather than a research document?
//
// The signal is the question-heading contract, because that is what the
// essay template and the FAQ markup actually need — a document without it
// gains nothing from being called an essay. Research reports, filings and
// transcripts essentially never have a majority of interrogative headings.
export function looksLikeEssay(bodyMd: string): boolean {
  const headings = (bodyMd ?? "")
    .split("\n")
    .map((l) => l.match(/^##\s+(.+?)\s*$/)?.[1]?.trim())
    .filter((h): h is string => Boolean(h) && !SOURCES_HEADING.test(h as string));
  if (headings.length < 2) return false;
  const questions = headings.filter((h) => h.endsWith("?")).length;
  return questions * 2 >= headings.length;
}

// ---- the lint -------------------------------------------------------------

export type LintLevel = "error" | "warn" | "info";
export interface LintNote {
  level: LintLevel;
  message: string;
}

// Advisory, never blocking. An essay that trips every rule here still
// publishes — the operator is the editor, and a linter that refuses to
// publish is a linter that gets worked around. What it buys is that the
// answer-first discipline stays visible instead of quietly eroding.
export function lintEssay(essay: ParsedEssay): LintNote[] {
  const notes: LintNote[] = [];
  if (!essay.title)
    notes.push({ level: "error", message: "No title — start the file with `# Title`." });
  if (!essay.summary) {
    notes.push({
      level: "warn",
      message:
        "No summary paragraph before the first section. Answer engines quote this block more than any other.",
    });
  }
  if (!essay.sections.length) {
    notes.push({
      level: "error",
      message: "No sections. A section starts with a `## ` heading, ideally a question.",
    });
  }

  essay.sections.forEach((s, i) => {
    const n = i + 1;
    if (!s.paragraphs.length) {
      notes.push({
        level: "error",
        message: `Section ${n} ("${s.heading}") has no text under it.`,
      });
      return;
    }
    if (!s.isQuestion) {
      notes.push({
        level: "info",
        message: `Section ${n} ("${s.heading}") isn't phrased as a question, so it won't appear in the page's Q&A structured data.`,
      });
    }
    const opening = (s.paragraphs[0] ?? "").replace(/<[^>]+>/g, "");
    const words = opening.split(/\s+/).filter(Boolean).length;
    if (words > 70) {
      notes.push({
        level: "warn",
        message: `Section ${n}: the opening paragraph is ${words} words. The answer should land in the first sentence or two — aim under 60.`,
      });
    }
  });

  if (!essay.sources.length) {
    notes.push({
      level: "warn",
      message:
        "No `## Sources` block. Cited writing is quoted more often, and it's the house rule.",
    });
  } else {
    const cited = new Set(
      [...JSON.stringify(essay.sections).matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])),
    );
    essay.sources.forEach((_, i) => {
      if (!cited.has(i + 1)) {
        notes.push({
          level: "info",
          message: `Source ${i + 1} is listed but never cited inline — reference it as [${i + 1}] in the text.`,
        });
      }
    });
  }
  return notes;
}

// ---- the tetrad ------------------------------------------------------------
//
// McLuhan's four questions, as a Markdown shape (docs/the-record.md §1b): a
// file whose `##` headings are exactly Enhances · Obsolesces · Retrieves ·
// Reverses, in any order, each followed by prose. Like the Q&A convention,
// the structure is derived from the file and nothing calls a model. It is
// NOT an essay by the question rule — none of its headings is a question —
// so the classifier below names it separately and the piece is filed as
// kind "essay" with `metadata.classification = "tetrad"`.

export type TetradQuadrant = "enhances" | "obsolesces" | "retrieves" | "reverses";

export const TETRAD_QUADRANTS: readonly TetradQuadrant[] = [
  "enhances",
  "obsolesces",
  "retrieves",
  "reverses",
];

export interface ParsedTetrad {
  /** The H1 — the medium, artefact or idea the four questions are asked of. */
  subject: string;
  dek: string;
  /** Preamble paragraphs after the dek, verbatim Markdown. */
  intro: string[];
  /** Each quadrant's prose, verbatim Markdown, in the file's own order of lines. */
  quadrants: Record<TetradQuadrant, string>;
  /** A `## Sources` list, when the file has one. */
  sources: string[];
}

const QUADRANT_HEADING: Record<string, TetradQuadrant> = {
  enhances: "enhances",
  enhance: "enhances",
  obsolesces: "obsolesces",
  obsolesce: "obsolesces",
  retrieves: "retrieves",
  retrieve: "retrieves",
  reverses: "reverses",
  reverse: "reverses",
  "reverses into": "reverses",
  "flips into": "reverses",
};

function quadrantOf(heading: string): TetradQuadrant | null {
  const key = heading
    .trim()
    .replace(/[:?.]+$/, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
  return QUADRANT_HEADING[key] ?? null;
}

/**
 * The four `##` headings of a file, or null when they are not exactly the
 * tetrad. `## Sources` is allowed alongside; any other heading disqualifies.
 */
function tetradHeadings(bodyMd: string): Map<TetradQuadrant, string> | null {
  const found = new Map<TetradQuadrant, string>();
  for (const line of (bodyMd ?? "").replace(/\r/g, "").split("\n")) {
    const h2 = line.match(/^##\s+(.+?)\s*$/)?.[1];
    if (!h2) continue;
    if (SOURCES_HEADING.test(h2.trim())) continue;
    const q = quadrantOf(h2);
    if (!q || found.has(q)) return null;
    found.set(q, h2);
  }
  return found.size === 4 ? found : null;
}

export function looksLikeTetrad(bodyMd: string): boolean {
  return tetradHeadings(bodyMd) !== null;
}

export function parseTetrad(bodyMd: string): ParsedTetrad | null {
  if (!tetradHeadings(bodyMd)) return null;
  // The essay parser gives the title, dek, preamble and sources; the
  // quadrants are re-read raw because it folds a section's lines into
  // single-line paragraphs, and a quadrant's lists and emphasis are wanted
  // as written.
  const essay = parseEssay(bodyMd);
  const raw = rawSections(bodyMd);
  const quadrants = {} as Record<TetradQuadrant, string>;
  for (const q of TETRAD_QUADRANTS) quadrants[q] = raw.get(q) ?? "";
  const intro = essay.summary ? [essay.summary] : [];
  return { subject: essay.title, dek: essay.dek, intro, quadrants, sources: essay.sources };
}

/** The verbatim Markdown under each quadrant heading, trimmed. */
function rawSections(bodyMd: string): Map<TetradQuadrant, string> {
  const out = new Map<TetradQuadrant, string>();
  let current: TetradQuadrant | null = null;
  let buf: string[] = [];
  const flush = () => {
    if (current) out.set(current, buf.join("\n").trim());
    buf = [];
  };
  for (const line of (bodyMd ?? "").replace(/\r/g, "").split("\n")) {
    const h2 = line.match(/^##\s+(.+?)\s*$/)?.[1];
    if (h2 !== undefined) {
      flush();
      current = quadrantOf(h2);
      continue;
    }
    if (current) buf.push(line);
  }
  flush();
  return out;
}
