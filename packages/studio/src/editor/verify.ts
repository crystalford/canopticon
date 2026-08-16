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

/** THE CHECK THIS FILE DID NOT HAVE, AND THE FAILURE THAT PROVED IT.
 *
 *  Run against production for the first time, the model returned five
 *  sections covering characters 0–635 of a 1730-character essay. It read
 *  the first third and stopped. Nothing here looked, because every phrase
 *  it DID offer was genuinely the essay's own text — so the firewall this
 *  file exists to be reported no damage at all.
 *
 *  The consequence is not cosmetic. `planSpans` walks SECTIONS, so the
 *  uncovered two thirds was never spoken: the film narrated the opening
 *  and silently dropped the rest of the writing. Every signal downstream
 *  stayed green — 201 created, 202 accepted, `spoken 5 / spans 5 /
 *  measured 5 / failures []`, and a cut that announced "every word timed
 *  to the voice". The one number that looked like confirmation,
 *  `spokenWords: 286`, was counted off the essay rather than off the
 *  spans, so it reported the whole essay while a third of it was planned.
 *
 *  Ragged edges are repaired below — a model miscounting a boundary by a
 *  clause is ordinary. A model that offered this little of the essay did
 *  not read it, and no amount of stretching one section over the missing
 *  two thirds would make its structural judgement real. Under this floor
 *  the reading is declined and the rules editor runs instead. */
const COVERAGE_FLOOR = 0.75;

export function verifyEditorial(raw: unknown, essay: string): Verified {
  const notes: string[] = [];
  if (!raw || typeof raw !== "object") {
    return { editorial: empty(), rejectedPhrases: 0, declined: true, notes: ["not an object"] };
  }
  const o = raw as Record<string, unknown>;

  const { sections, coverage } = readSections(o.sections, essay, notes);
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

  // BEATS ARE TILED TOO, and for the same reason as sections: `timeBeats`
  // finds each beat's start and end by looking up spine words INSIDE its
  // own range, so a beat set that stops short of the essay produces a cut
  // that stops short of the recording. Caught live: a film whose sections
  // covered the essay still ended its picture 3.3 seconds before its own
  // voice did, because the model's beats were narrower than its sections.
  // A held gap between two beats is folded into whichever beat is nearer,
  // the same repair as a gap between sections — a beat that runs a little
  // long is an ordinary edit; a silent picture under real narration is not.
  beats.sort((a, b) => a.range.startChar - b.range.startChar);
  const beatCoverage = beats.length > 0 ? tileCoverage(beats, essay) : 0;

  const coverageFloorMissed = beats.length > 0 && Math.min(coverage, beatCoverage) < COVERAGE_FLOOR;
  const tooDamaged =
    beats.length === 0 ||
    (offered > 0 && rejected / offered > REJECT_CEILING) ||
    coverageFloorMissed;
  if (tooDamaged) {
    const pct = Math.round(Math.min(coverage, beatCoverage) * 100);
    notes.push(
      beats.length === 0
        ? "no usable beats"
        : coverageFloorMissed
          ? `the reading covered only ${pct}% of the essay — it did not read the whole thing, so the whole reading is untrusted`
          : `over ${Math.round(REJECT_CEILING * 100)}% of phrases were invented — the whole reading is untrusted`,
    );
  } else if (coverage < 0.999 || beatCoverage < 0.999) {
    const pct = Math.round(Math.min(coverage, beatCoverage) * 100);
    notes.push(
      `the reading covered ${pct}% of the essay; the gaps were folded into the neighbouring sections and beats so all of it is spoken and shown`,
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

function readSections(
  v: unknown,
  essay: string,
  notes: string[],
): { sections: Section[]; coverage: number } {
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
  if (out.length === 0) {
    notes.push("no usable sections — treating the essay as one");
    return { sections: out, coverage: 0 };
  }
  out.sort((a, b) => a.range.startChar - b.range.startChar);
  return { sections: out, coverage: tileCoverage(out, essay) };
}

/** Every character of the essay must belong to exactly one item in
 *  `ranges`, because a character claimed by none of them is a character
 *  `timeBeats`/`planSpans` never reach — narration that stops speaking, or
 *  a picture that stops being drawn, while the other continues. Both
 *  sections and beats need this, so it is one function: measures how much
 *  of the essay the caller's own ranges actually reached BEFORE repairing
 *  anything (repairing first would always report 100%), then closes every
 *  gap by folding it into whichever neighbour is nearer, split at the
 *  sentence boundary closest to the gap's middle so a repair does not
 *  leave a section or beat opening mid-clause.
 *
 *  `ranges` must already be sorted by `range.startChar` and non-empty.
 *  Mutates in place and returns the coverage measured before the repair. */
function tileCoverage(ranges: { range: { startChar: number; endChar: number } }[], essay: string) {
  let offered = 0;
  let reach = 0;
  for (const r of ranges) {
    offered += Math.max(0, r.range.endChar - Math.max(r.range.startChar, reach));
    reach = Math.max(reach, r.range.endChar);
  }
  const coverage = essay.length > 0 ? offered / essay.length : 0;

  const first = ranges[0];
  if (!first) return coverage;
  first.range.startChar = 0;

  let prev = first.range;
  for (let i = 1; i < ranges.length; i++) {
    const here = ranges[i]?.range;
    if (!here) continue;
    if (here.startChar > prev.endChar) {
      const cut = sentenceBoundaryNear(essay, Math.round((prev.endChar + here.startChar) / 2));
      prev.endChar = Math.max(prev.startChar + 1, cut);
      here.startChar = prev.endChar;
    } else {
      here.startChar = prev.endChar;
    }
    here.endChar = Math.max(here.endChar, here.startChar + 1);
    prev = here;
  }
  prev.endChar = essay.length;

  return coverage;
}

/** The nearest end-of-sentence or paragraph break to `at`, or `at` itself.
 *  Bounded so a repair never drags a boundary halfway across the essay. */
function sentenceBoundaryNear(essay: string, at: number): number {
  const WINDOW = 400;
  let best = at;
  let bestGap = Number.POSITIVE_INFINITY;
  const from = Math.max(0, at - WINDOW);
  const to = Math.min(essay.length, at + WINDOW);
  for (let i = from; i < to; i++) {
    const isBreak =
      (essay[i] === "\n" && essay[i + 1] === "\n") ||
      (".!?".includes(essay[i] as string) && /\s/.test(essay[i + 1] ?? " "));
    if (!isBreak) continue;
    const end = essay[i] === "\n" ? i + 2 : i + 1;
    const gap = Math.abs(end - at);
    if (gap < bestGap) {
      bestGap = gap;
      best = end;
    }
  }
  return best;
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
