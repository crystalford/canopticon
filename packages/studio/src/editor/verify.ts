// THE VERIFIER — the firewall between a model and the screen.
//
// This is the most important file in the editor. Everything the model says
// about STRUCTURE is a judgement and may be wrong without much harm. But
// `phrases` are the actual words that appear in the film, and a model that
// paraphrases there is writing ad copy onto somebody's essay.
//
// So the rule is the one this codebase already trusts elsewhere: a phrase
// is only real if it is a literal substring of the source at its own
// offset. Not similar. Not close. The same characters.
//
// Anything that fails is DROPPED AND COUNTED, and if too much fails the
// whole response is declined and the rules editor runs instead.

import {
  BEAT_ROLES,
  CONTINUITIES,
  type EditorialBeat,
  type EditorialModel,
  MOTIF_ARCS,
  type Motif,
  PROMOTIONS,
  type Phrase,
  SECTION_FUNCTIONS,
  type Section,
} from "../film/schema.ts";

export interface Verified {
  editorial: EditorialModel;
  rejectedPhrases: number;
  /** True when the response was too damaged to use at all. */
  declined: boolean;
  notes: string[];
}

/** More than this share of phrases invented → do not trust the reading. */
const REJECT_CEILING = 0.6;

export function verifyEditorial(raw: unknown, essay: string): Verified {
  const notes: string[] = [];
  if (!raw || typeof raw !== "object") {
    return { editorial: empty(), rejectedPhrases: 0, declined: true, notes: ["not an object"] };
  }
  const o = raw as Record<string, unknown>;

  const sections = readSections(o.sections, essay, notes);
  const motifs = readMotifs(o.motifs, essay, notes);
  const motifIds = new Set(motifs.map((m) => m.id));
  const sectionIds = new Set(sections.map((s) => s.id));

  let offered = 0;
  let rejected = 0;
  const beats: EditorialBeat[] = [];
  for (const item of asArray(o.beats)) {
    const b = item as Record<string, unknown>;
    const range = readRange(b, essay);
    if (!range) continue;
    const id = str(b.id) || `b${beats.length + 1}`;
    const sectionId = str(b.sectionId);
    const phrases: Phrase[] = [];
    for (const p of asArray(b.phrases)) {
      offered++;
      const kept = verifyPhrase(p as Record<string, unknown>, essay, motifIds);
      if (kept) phrases.push(kept);
      else rejected++;
    }
    beats.push({
      id,
      sectionId: sectionIds.has(sectionId) ? sectionId : (sections[0]?.id ?? "s1"),
      range,
      role: pick(b.role, BEAT_ROLES, "develop"),
      emphasis: unit(b.emphasis, 0.5),
      certainty: unit(b.certainty, 0.7),
      continuity: pick(b.continuity, CONTINUITIES, "continue"),
      // A promotion that claims text it does not have is a lie the film
      // would render as an empty frame.
      promotion: phrases.length === 0 ? "none" : pick(b.promotion, PROMOTIONS, "phrase"),
      phrases,
      ...(phrases[0]?.motifId
        ? { motifRef: { motifId: phrases[0].motifId as string, treatment: "repeat" as const } }
        : {}),
    });
  }

  if (rejected > 0) {
    notes.push(`${rejected} of ${offered} phrases were not the essay's own words and were dropped`);
  }

  const tooDamaged = beats.length === 0 || (offered > 0 && rejected / offered > REJECT_CEILING);
  if (tooDamaged) {
    notes.push(
      beats.length === 0
        ? "no usable beats"
        : `over ${Math.round(REJECT_CEILING * 100)}% of phrases were invented — the whole reading is untrusted`,
    );
  }

  return {
    editorial: {
      thesis: str(o.thesis),
      register: pick(
        o.register,
        ["polemic", "analytic", "elegiac", "reportorial", "confessional"] as const,
        "analytic",
      ),
      sections: sections.length > 0 ? sections : [wholeEssay(essay)],
      beats,
      motifs,
      callbacks: [],
    },
    rejectedPhrases: rejected,
    declined: tooDamaged,
    notes,
  };
}

/** THE CHECK EVERYTHING ELSE EXISTS TO PROTECT.
 *
 *  An offset that is merely wrong is repaired — models miscount characters
 *  constantly and the text itself is still the essay's. An offset whose
 *  text is nowhere in the essay is an invention, and it is dropped. */
function verifyPhrase(
  p: Record<string, unknown>,
  essay: string,
  motifIds: Set<string>,
): Phrase | null {
  const text = str(p.text).trim();
  if (text.length < 2) return null;
  const claimed = int(p.offset, -1);
  if (claimed >= 0 && essay.slice(claimed, claimed + text.length) === text) {
    return keep(text, claimed, p, motifIds);
  }
  const found = essay.indexOf(text);
  if (found >= 0) return keep(text, found, p, motifIds);
  return null;
}

function keep(
  text: string,
  offset: number,
  p: Record<string, unknown>,
  motifIds: Set<string>,
): Phrase {
  const motifId = str(p.motifId);
  return {
    text,
    offset,
    weight: unit(p.weight, 0.6),
    ...(motifId && motifIds.has(motifId) ? { motifId } : {}),
  };
}

function readSections(v: unknown, essay: string, notes: string[]): Section[] {
  const out: Section[] = [];
  for (const item of asArray(v)) {
    const s = item as Record<string, unknown>;
    const range = readRange(s, essay);
    if (!range) continue;
    out.push({
      id: str(s.id) || `s${out.length + 1}`,
      range,
      function: pick(s.function, SECTION_FUNCTIONS, "evidence"),
      intensity: unit(s.intensity, 0.5),
      certainty: unit(s.certainty, 0.7),
    });
  }
  if (out.length === 0) notes.push("no usable sections — treating the essay as one");
  return out;
}

function readMotifs(v: unknown, essay: string, notes: string[]): Motif[] {
  const out: Motif[] = [];
  for (const item of asArray(v)) {
    const m = item as Record<string, unknown>;
    const phrase = str(m.phrase).trim();
    if (phrase.length < 3) continue;
    // Every occurrence is found in the essay ourselves rather than trusted;
    // and a "motif" the essay uses once is not a motif.
    const occurrences: number[] = [];
    let at = essay.toLowerCase().indexOf(phrase.toLowerCase());
    while (at >= 0) {
      occurrences.push(at);
      at = essay.toLowerCase().indexOf(phrase.toLowerCase(), at + 1);
    }
    if (occurrences.length < 2) {
      notes.push(`motif "${phrase}" occurs ${occurrences.length}× — not a recurrence`);
      continue;
    }
    out.push({
      id: str(m.id) || `m${out.length + 1}`,
      phrase,
      occurrences,
      arc: pick(m.arc, MOTIF_ARCS, "survive"),
    });
  }
  return out;
}

function readRange(o: Record<string, unknown>, essay: string) {
  const startChar = int(o.startChar, -1);
  const endChar = int(o.endChar, -1);
  if (startChar < 0 || endChar <= startChar) return null;
  return { startChar: Math.min(startChar, essay.length), endChar: Math.min(endChar, essay.length) };
}

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const int = (v: unknown, d: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.round(v) : d;
const unit = (v: unknown, d: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : d;
function pick<T extends readonly string[]>(v: unknown, allowed: T, d: T[number]): T[number] {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? v : d;
}

const wholeEssay = (essay: string): Section => ({
  id: "s1",
  range: { startChar: 0, endChar: essay.length },
  function: "evidence",
  intensity: 0.5,
  certainty: 0.7,
});

const empty = (): EditorialModel => ({
  thesis: "",
  register: "analytic",
  sections: [],
  beats: [],
  motifs: [],
  callbacks: [],
});
