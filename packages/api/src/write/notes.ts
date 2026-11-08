// The research notes bank, and writing a report section by section.
//
// Why (2026-11-05): research conversations carried every page read and wrote
// the report in one go at the end. The live record's own conversations made
// 7–22 failed quotation checks each and carried up to 6.5 million characters
// of pages. Practice from research agents that work (Anthropic's research
// system, WebWeaver, LongWriter): note the evidence while reading, outline
// first, write each section from its own notes. Here:
//   - note_evidence keeps a passage, checked word for word against the kept
//     page when it is made (a note that is not there is refused, with the
//     page's nearest words), and numbers its source in code;
//   - write_outline lays the report out, each section with a target length;
//   - write_section writes one part, and the Sources list is rebuilt from the
//     notes every time, so a source's number never drifts;
//   - pages can then leave the model's view early (they stay kept): the notes
//     carry what was needed from them.

import type Anthropic from "@anthropic-ai/sdk";
import type { Env } from "../env";
import { all, run } from "../lib/d1";
import { verbatimNormal } from "./check";
import { type ResearchSource, nearestPassage } from "./research";

export interface Note {
  n: number;
  url: string;
  quote: string;
  claim: string;
  section: number | null;
}

export interface NoteStore {
  add(draftId: string, note: Omit<Note, "n">): Promise<Note>;
  list(draftId: string): Promise<Note[]>;
}

export function d1Notes(env: Env, userId: string): NoteStore {
  return {
    async add(draftId, note) {
      const prev = await all<{ n: number }>(
        env.DB,
        "SELECT MAX(n) AS n FROM research_notes WHERE draft_id = ? AND user_id = ?",
        [draftId, userId],
      ).catch(() => []);
      const n = (prev[0]?.n ?? 0) + 1;
      await run(
        env.DB,
        `INSERT INTO research_notes (id, draft_id, user_id, n, url, quote, claim, section, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID().replace(/-/g, "").slice(0, 16),
          draftId,
          userId,
          n,
          note.url,
          note.quote,
          note.claim,
          note.section,
          new Date().toISOString(),
        ],
      );
      return { ...note, n };
    },
    async list(draftId) {
      return (
        await all<{ n: number; url: string; quote: string; claim: string; section: number | null }>(
          env.DB,
          "SELECT n, url, quote, claim, section FROM research_notes WHERE draft_id = ? AND user_id = ? ORDER BY n",
          [draftId, userId],
        ).catch(() => [])
      ).map((r) => ({ ...r }));
    },
  };
}

export function memoryNotes(): NoteStore {
  const rows = new Map<string, Note[]>();
  return {
    async add(draftId, note) {
      const list = rows.get(draftId) ?? [];
      const made = { ...note, n: list.length + 1 };
      rows.set(draftId, [...list, made]);
      return made;
    },
    async list(draftId) {
      return rows.get(draftId) ?? [];
    },
  };
}

const flat = (s: string) => verbatimNormal(s).replace(/\s+/g, " ").trim();

/** Source numbers, in the order sources were first noted. */
export function sourceNumbers(notes: Note[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const n of notes) if (!out.has(n.url)) out.set(n.url, out.size + 1);
  return out;
}

/** Whether a note's words are on the page it names (else on any kept page,
 *  whose address it then takes). */
export function placeNote(
  quote: string,
  url: string,
  pages: ResearchSource[],
): { url: string } | { near: { url: string; text: string } | null } {
  const q = flat(quote);
  const named = pages.filter((p) => p.url === url);
  for (const p of [...named, ...pages.filter((p) => p.url !== url)])
    if (flat(p.text).includes(q)) return { url: p.url };
  return { near: nearestPassage(quote, named.length ? named : pages) };
}

// ---- the report's shape -----------------------------------------------------------

export interface OutlineSection {
  heading: string;
  words: number;
}

const TO_WRITE = "_(to write)_";

/** The report laid out from an outline. Parts already written under the same
 *  heading are kept. */
export function skeleton(sections: OutlineSection[], before = ""): string {
  const kept = (heading: string) => {
    const at = before.indexOf(`\n${heading}\n`);
    if (at < 0) return null;
    const rest = before.slice(at + heading.length + 2);
    const end = rest.search(SECTION_END);
    const text = (end < 0 ? rest : rest.slice(0, end)).trim();
    return text && !text.startsWith(TO_WRITE.slice(0, 4)) ? text : null;
  };
  const summary = partOf(before, "summary");
  const closing = partOf(before, "closing");
  const details = sections
    .map((s, i) => {
      const heading = `### ${i + 1}. ${s.heading.trim()}`;
      return `${heading}\n\n${kept(heading) ?? `${TO_WRITE} About ${s.words} words.`}`;
    })
    .join("\n\n");
  return `${summary ?? `## TL;DR\n\n${TO_WRITE}\n\n## Key Findings\n\n${TO_WRITE}`}\n\n## Details\n\n${details}\n\n${closing ?? `## Open questions\n\n${TO_WRITE}`}\n\n## Sources\n\n(Built from the notes.)\n`;
}

/** One part of the report: "summary" (TL;DR and Key Findings, before
 *  Details), a Details section by number, or "closing" (after the last
 *  Details section, before Sources). */
function partOf(body: string, part: "summary" | "closing"): string | null {
  if (part === "summary") {
    const end = body.indexOf("\n## Details");
    const text = end < 0 ? "" : body.slice(0, end).trim();
    return text && !text.includes(TO_WRITE) ? text : null;
  }
  const start = body.indexOf("\n## Details");
  const sources = body.indexOf("\n## Sources");
  if (start < 0 || sources < 0) return null;
  const after = body.slice(start + 1, sources);
  const m = /\n## (?!Details)/.exec(after);
  const text = m ? after.slice(m.index).trim() : "";
  return text && !text.includes(TO_WRITE) ? text : null;
}

/** The body with one part replaced. Null when the part is not in the body. */
export function replacePart(body: string, part: string, text: string): string | null {
  const clean = text.trim();
  if (part === "summary") {
    const end = body.indexOf("\n## Details");
    if (end < 0) return null;
    return `${clean}\n${body.slice(end)}`;
  }
  if (part === "closing") {
    const details = body.indexOf("\n## Details");
    const sources = body.indexOf("\n## Sources");
    if (details < 0 || sources < 0) return null;
    // The closing starts at the first ## part after the LAST numbered
    // section, never inside the Details: live (2026-11-08), a section that
    // carried its own "## " heading made the closing cut there, and four
    // written sections vanished from a report that said it was complete.
    const lastSection = [...body.slice(0, sources).matchAll(/\n### \d+\. [^\n]*\n/g)].pop();
    const after = lastSection ? (lastSection.index ?? 0) + lastSection[0].length : details + 1;
    const m = /\n## (?!Details)/.exec(body.slice(after, sources));
    const cut = m ? after + m.index : sources;
    return `${body.slice(0, cut)}\n\n${clean}\n${body.slice(sources)}`;
  }
  const n = Number(part);
  if (!Number.isInteger(n) || n < 1) return null;
  const head = new RegExp(`\\n### ${n}\\. [^\\n]*\\n`);
  const m = head.exec(body);
  if (!m) return null;
  const from = m.index + m[0].length;
  const rest = body.slice(from);
  // A section runs to the next numbered section (or ## part), not to the
  // next heading: live, a section written with its own ### subheadings was
  // rewritten, only its first part was replaced, and the old subsections
  // stayed — 32 paragraphs repeated in one 15,000-word report.
  const next = rest.search(SECTION_END);
  const to = next < 0 ? body.length : from + next;
  // A section's own headings sit below it: "#", "##" and unnumbered "###"
  // become "####", so nothing inside a section can end the Details or the
  // section (a "## " inside one once cut four sections from a report).
  const own = clean
    .replace(/^### \d+\. [^\n]*\n/, "")
    .replace(/^#{1,2} /gm, "#### ")
    .replace(/^### (?!\d+\. )/gm, "#### ");
  return `${body.slice(0, from)}\n${own}\n${body.slice(to)}`;
}

/** Where a Details section ends: the next numbered section or ## part. */
const SECTION_END = /\n(### \d+\. |## )/;

/** The Details sections as written: number, heading and text (without the
 *  heading). A section still to write has empty text. */
export function sectionsOf(body: string): Array<{ n: number; heading: string; text: string }> {
  const out: Array<{ n: number; heading: string; text: string }> = [];
  for (const m of body.matchAll(/\n### (\d+)\. ([^\n]*)\n/g)) {
    const from = (m.index ?? 0) + m[0].length;
    const next = body.slice(from).search(SECTION_END);
    const text = body.slice(from, next < 0 ? body.length : from + next).trim();
    out.push({
      n: Number(m[1]),
      heading: (m[2] ?? "").trim(),
      text: text.startsWith(TO_WRITE) ? "" : text,
    });
  }
  return out;
}

/** The body with its Sources list rebuilt from the notes. */
export function withSources(body: string, notes: Note[], pages: ResearchSource[]): string {
  const numbers = sourceNumbers(notes);
  const titles = new Map(pages.map((p) => [p.url, p.title]));
  const list = [...numbers.entries()]
    .map(([url, k]) => `${k}. [${(titles.get(url) ?? url).replace(/[[\]]/g, "")}](${url})`)
    .join("\n");
  const at = body.indexOf("\n## Sources");
  const head = at < 0 ? body.trimEnd() : body.slice(0, at).trimEnd();
  return `${head}\n\n## Sources\n\n${list || "(Built from the notes; nothing noted yet.)"}\n`;
}

/** Parts of the report still to write. */
export function unwritten(body: string): string[] {
  const out: string[] = [];
  for (const m of body.matchAll(/^(#{2,3}) ([^\n]+)\n+_\(to write\)_/gm)) out.push(m[2] ?? "");
  return out;
}

// ---- the tools ----------------------------------------------------------------------

export const OUTLINE_TOOL: Anthropic.Beta.BetaToolUnion = {
  name: "write_outline",
  description:
    "Lay the report out before writing it: its title, topic and Details sections (one per sub-question), each with a target length in words. Sections already written under the same heading are kept. Call again to revise the outline.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      topic: { type: "string" },
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            heading: { type: "string", description: "The sub-question this section answers" },
            words: { type: "number", description: "Target length" },
          },
          required: ["heading", "words"],
        },
      },
    },
    required: ["title", "topic", "sections"],
  },
};

export const NOTE_EVIDENCE_TOOL: Anthropic.Beta.BetaToolUnion = {
  name: "note_evidence",
  description:
    "Keep a passage you will use: the page's address, its exact words (checked word for word against the page now), the claim they support, and the Details section it is for. Returns the source's number [n] to cite. Note while you read; pages may later leave your view, notes stay.",
  input_schema: {
    type: "object",
    properties: {
      url: { type: "string" },
      quote: { type: "string", description: "The page's exact words, a sentence or two" },
      claim: { type: "string", description: "What this passage shows, in your words" },
      section: { type: "number", description: "The Details section number it is for" },
    },
    required: ["url", "quote", "claim"],
  },
};

export const LIST_NOTES_TOOL: Anthropic.Beta.BetaToolUnion = {
  name: "list_notes",
  description:
    "Your notes so far, each with its source number, claim and exact words; give a section number for that section's notes only.",
  input_schema: {
    type: "object",
    properties: { section: { type: "number" } },
  },
};

export const WRITE_SECTION_TOOL: Anthropic.Beta.BetaToolUnion = {
  name: "write_section",
  description:
    'Write one part of the report: a Details section by its number (its text only, without the heading), "summary" (the TL;DR and Key Findings, with their ## headings), or "closing" (Open questions, and Beyond this question if there is something to say, with their ## headings). The Sources list is rebuilt from your notes each time. Returns the quotation check.',
  eager_input_streaming: true,
  input_schema: {
    type: "object",
    properties: {
      part: { type: "string", description: 'A section number, "summary" or "closing"' },
      text: { type: "string", description: "The Markdown for that part" },
    },
    required: ["part", "text"],
  },
};

export const NOTES_TOOLS = [OUTLINE_TOOL, NOTE_EVIDENCE_TOOL, LIST_NOTES_TOOL, WRITE_SECTION_TOOL];

export function describeNotes(notes: Note[], section?: number | ((n: Note) => boolean)): string {
  const numbers = sourceNumbers(notes);
  const shown =
    typeof section === "function"
      ? notes.filter(section)
      : section
        ? notes.filter((n) => n.section === section)
        : notes;
  if (!shown.length) return section ? `No notes for section ${section} yet.` : "No notes yet.";
  return shown
    .map(
      (n) =>
        `cite as [${numbers.get(n.url)}]${n.section ? ` · section ${n.section}` : ""} · note ${n.n}: ${n.claim}\n  "${n.quote}"\n  ${n.url}`,
    )
    .join("\n");
}
