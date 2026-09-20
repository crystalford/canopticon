// Candidate titles for a document that published under a working title.
//
// "PASS 7-MINI — HARDENING DOSSIER" is what a research session called itself.
// It is the page's H1, its <title> tag and its citation line, and it tells a
// reader nothing. But upload is authorization (standing rule 2), so nothing
// here blocks a publish: the document goes live under the name it arrived
// with, and these are offered afterwards, one click to accept.
//
// NOTHING HERE RENAMES ANYTHING. It proposes. `title_approved_at` is what says
// a person chose, and without it the stored title stands. A title is the most
// quoted line a document has and it is not worth being clever with.
//
// CANDIDATES ARE SELECTED, NOT COMPOSED.
//
// The same firewall the quote layer uses: what comes back is the document's
// own text, located in the document, never a model's paraphrase of it. That is
// possible more often than it sounds, because a research document usually
// states its own subject in its first real sentence or its first hardened
// fact — the PASS 7 dossier's opening fact is "Rosalie Nadeau is Director of
// Research and Advertising in the Carney PMO", which is a better title than
// anything worth generating.
//
// A composed candidate can be added later as a second source; it would need a
// model at authoring time and a row to freeze into, which rule 5 allows. It is
// deliberately not here yet: the selected path costs nothing, cannot
// hallucinate, and has to be the floor anyway.

/** How long a title may be before it stops working as one. */
const MAX_TITLE = 90;
const MIN_TITLE = 18;

/**
 * Up to three candidate titles, best first, drawn from the document's own text.
 *
 * Returns an empty array when the document offers nothing better — which is a
 * real outcome and must not be papered over with a worse suggestion than the
 * title already there.
 */
export function titleCandidates(bodyMd: string): string[] {
  if (!bodyMd?.trim()) return [];
  const out: string[] = [];

  for (const cand of [...tableFacts(bodyMd), ...sentences(bodyMd)]) {
    const clean = tidy(cand);
    if (!usable(clean)) continue;
    // Case-insensitive de-dupe: two sources often surface the same sentence.
    if (out.some((o) => o.toLowerCase() === clean.toLowerCase())) continue;
    out.push(clean);
    if (out.length === 3) break;
  }
  return out;
}

/**
 * Facts out of the document's own summary table, which is where a research
 * document puts the thing it most wants understood.
 *
 * A row like `| 1 | Rosalie Nadeau is Director… | Hill Times… | HIGH |` has its
 * claim in the widest cell; the rest is numbering, sourcing and confidence.
 */
function tableFacts(md: string): string[] {
  const out: string[] = [];
  for (const line of md.split("\n")) {
    if (!line.includes("|")) continue;
    if (/^\s*\|?\s*:?-{2,}/.test(line)) continue; // delimiter row
    const cells = line
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length < 2) continue;
    // The widest cell is the claim. Numbering and HIGH/LOW are short.
    const widest = cells.reduce((a, b) => (b.length > a.length ? b : a), "");
    if (widest.length >= MIN_TITLE) out.push(widest);
    if (out.length >= 4) break;
  }
  return out;
}

/** The document's own opening sentences, skipping its scaffolding. */
function sentences(md: string): string[] {
  const prose = md
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      if (!t) return false;
      if (t.startsWith("#")) return false; // headings — often the working title itself
      if (t.startsWith(">") || t.startsWith("|")) return false;
      if (/^[-*+]\s|^\d+[.)]\s/.test(t)) return false;
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) return false;
      return true;
    })
    .join(" ");
  return prose
    .split(/(?<=[.!?])\s+/)
    .slice(0, 6)
    .map((s) => s.trim());
}

function tidy(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // markdown links → their text
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.,;:]\s*$/, "")
    .trim();
}

function usable(s: string): boolean {
  if (s.length < MIN_TITLE || s.length > MAX_TITLE) return false;
  // A title is a statement, not a fragment of apparatus.
  if (/^(https?:\/\/|www\.)/i.test(s)) return false;
  if (/^(source|sources|confidence|note|notes|fact|summary|table)\b/i.test(s)) return false;
  // Needs enough words to say something.
  if (s.split(/\s+/).filter(Boolean).length < 4) return false;
  // Reject anything that is mostly punctuation, digits or shouting.
  const letters = s.replace(/[^A-Za-z]/g, "");
  if (letters.length < s.length * 0.5) return false;
  if (letters.length >= 6 && letters === letters.toUpperCase()) return false;
  return true;
}
