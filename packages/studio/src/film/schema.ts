// THE FILM RECORD.
//
// One rule governs this whole file, and it is the reason the engine was
// rebuilt: there is no `primitiveId`, no `constructionId`, no `nounVisual`,
// no chain, no node, and no mapping from a noun to a picture. A beat says
// what the audience should experience. It never says what to draw.
//
// The record binds to the essay BY CHARACTER OFFSET and to nothing else.
// There are no "scenes". A sentence may produce no beat, share one, or
// become five.
//
// Stored whole in `ir_versions.ir_json`, which is an opaque TEXT column —
// so this shape needed no migration and the next one will not either.

import { z } from "zod";

/* ── settings ──────────────────────────────────────────────────────── */

export const SettingsSchema = z.object({
  /** Editorial density: how often the film changes its mind. NOT a speed
   *  multiplier on animation. */
  pace: z.number().min(0).max(1).default(0.5),
  /** Distance from the clean compositional baseline. NOT randomness — the
   *  same seed composes the same film at 0 and at 1; only the deviations
   *  grow. If chaos 1 is a *different* composition, chaos is wrong. */
  chaos: z.number().min(0).max(1).default(0.5),
  /** How much visual information occupies the frame. */
  density: z.number().min(0).max(1).default(0.5),
  /** Soft. Shapes the edit; never deletes a sentence. */
  targetSec: z.number().int().positive().optional(),
});
export type Settings = z.infer<typeof SettingsSchema>;

/* ── what the EDITOR knows ─────────────────────────────────────────── */

export const RangeSchema = z.object({
  startChar: z.number().int().min(0),
  endChar: z.number().int().min(0),
});
export type Range = z.infer<typeof RangeSchema>;

export const SECTION_FUNCTIONS = [
  "hook",
  "premise",
  "evidence",
  "turn",
  "escalation",
  "counter",
  "restatement",
  "resolution",
] as const;

export const SectionSchema = z.object({
  id: z.string(),
  range: RangeSchema,
  function: z.enum(SECTION_FUNCTIONS),
  /** How loud this section is. */
  intensity: z.number().min(0).max(1).default(0.5),
  /** 1 = asserted. 0 = the argument is undermining itself. Drives
   *  INSTABILITY, which is what makes a phrase degrade *because the
   *  argument is destabilising* rather than because a filter is on. */
  certainty: z.number().min(0).max(1).default(0.7),
});
export type Section = z.infer<typeof SectionSchema>;

export const BEAT_ROLES = [
  "open",
  "assert",
  "develop",
  "complicate",
  "turn",
  "escalate",
  "rest",
  "restate",
  "close",
] as const;

/** How this beat stands to the one before it. `continue` and `transform`
 *  both INHERIT the composition; only `interrupt` clears. Inheritance is
 *  the default and discontinuity has to be asked for — that is what makes
 *  the film one evolving system instead of a slideshow. */
export const CONTINUITIES = ["continue", "transform", "interrupt", "rest", "montage"] as const;

/** How much of the writing reaches the screen here. Most beats: none. */
export const PROMOTIONS = ["none", "word", "phrase", "fragments", "mass"] as const;

export const PhraseSchema = z.object({
  /** VERBATIM, and verified as a literal substring at `offset` before this
   *  record is ever stored. A model that paraphrases here would be writing
   *  ad copy onto the film. */
  text: z.string().min(1),
  offset: z.number().int().min(0),
  weight: z.number().min(0).max(1).default(0.5),
  motifId: z.string().optional(),
});
export type Phrase = z.infer<typeof PhraseSchema>;

export const MOTIF_ARCS = ["escalate", "degrade", "survive", "invert"] as const;
export const MOTIF_TREATMENTS = [
  "establish",
  "repeat",
  "degrade",
  "obscure",
  "restate",
  "invert",
] as const;

export const MotifSchema = z.object({
  id: z.string(),
  /** Verbatim, and must occur at least twice in the essay. A motif the
   *  essay does not itself return to is an invention. */
  phrase: z.string().min(1),
  occurrences: z.array(z.number().int().min(0)).min(1),
  arc: z.enum(MOTIF_ARCS).default("survive"),
});
export type Motif = z.infer<typeof MotifSchema>;

export const EditorialBeatSchema = z.object({
  id: z.string(),
  sectionId: z.string(),
  range: RangeSchema,
  role: z.enum(BEAT_ROLES),
  /** What the audience should feel the weight of. */
  emphasis: z.number().min(0).max(1).default(0.5),
  certainty: z.number().min(0).max(1).default(0.7),
  continuity: z.enum(CONTINUITIES).default("continue"),
  promotion: z.enum(PROMOTIONS).default("none"),
  /** Usually empty. A film where every sentence appears on screen is
   *  unwatchable. */
  phrases: z.array(PhraseSchema).default([]),
  motifRef: z.object({ motifId: z.string(), treatment: z.enum(MOTIF_TREATMENTS) }).optional(),
  /** The ONLY route to an illegible key phrase. Explicit, recorded, and
   *  reported — never an accident of a downstream effect. */
  legibility: z.literal("denied").optional(),
});
export type EditorialBeat = z.infer<typeof EditorialBeatSchema>;

export const EditorialModelSchema = z.object({
  thesis: z.string().default(""),
  register: z
    .enum(["polemic", "analytic", "elegiac", "reportorial", "confessional"])
    .default("analytic"),
  sections: z.array(SectionSchema).default([]),
  beats: z.array(EditorialBeatSchema).default([]),
  motifs: z.array(MotifSchema).default([]),
  callbacks: z
    .array(
      z.object({
        fromBeatId: z.string(),
        toBeatId: z.string(),
        kind: z.enum(["restate", "invert", "answer"]),
      }),
    )
    .default([]),
});
export type EditorialModel = z.infer<typeof EditorialModelSchema>;

/* ── the record ────────────────────────────────────────────────────── */

export const AssetSchema = z.object({
  assetId: z.string(),
  kind: z.enum(["audio", "alignment", "image", "data"]),
  r2Key: z.string(),
  sha256: z.string(),
  provenance: z.object({
    generatedBy: z.string(),
    params: z.record(z.string(), z.unknown()).default({}),
    createdAt: z.string(),
    sourceText: z.string().optional(),
  }),
});
export type Asset = z.infer<typeof AssetSchema>;

export const NarrationSpanSchema = z.object({
  spanId: z.string(),
  range: RangeSchema,
  /** What is actually spoken — markdown stripped. The essay keeps its
   *  markup; the voice does not read it aloud. */
  text: z.string(),
  voAssetId: z.string().optional(),
  alignmentAssetId: z.string().optional(),
});
export type NarrationSpan = z.infer<typeof NarrationSpanSchema>;

export const FilmSchema = z.object({
  schema: z.literal("canopticon.film/1"),
  filmId: z.string(),
  title: z.string(),
  /** The single source of truth. Everything binds into it by offset. */
  essay: z.string(),
  /** Same essay + same seed + same settings = the same film, forever. */
  seed: z.number().int().min(0),
  settings: SettingsSchema,

  /** FROZEN. Hashed. Never regenerated at render time — standing rule 1,
   *  structurally, exactly as narration already works. */
  editorial: EditorialModelSchema,
  editorialHash: z.string(),
  editorialProvenance: z.object({
    source: z.enum(["model", "rules"]),
    model: z.string().optional(),
    promptVersion: z.string(),
    createdAt: z.string(),
    declineReason: z
      .enum(["no-binding", "call-failed", "unparseable", "unverified", "empty"])
      .optional(),
    /** Phrases the verifier dropped as non-verbatim. A number that should
     *  be watched: a model inventing text is the failure that puts words
     *  on screen the essay never said. */
    rejectedPhrases: z.number().int().min(0).default(0),
  }),

  narration: z.object({
    voice: z.string().nullable(),
    spans: z.array(NarrationSpanSchema).default([]),
  }),
  assets: z.array(AssetSchema).default([]),
  createdAt: z.string(),
});
export type Film = z.infer<typeof FilmSchema>;

/* ── the timeline ──────────────────────────────────────────────────── */

export interface SpineWord {
  char: number;
  endChar: number;
  startMs: number;
  endMs: number;
  /** False when this word's time was interpolated rather than heard. */
  measured: boolean;
}

export interface SpinePause {
  atMs: number;
  ms: number;
  kind: "breath" | "beat" | "section";
}

/** The authoritative temporal spine. Built from measured audio when there
 *  is narration and from a rate model when there is not — the SAME shape
 *  either way, which is what makes narration a branch of one architecture
 *  instead of a plugin bolted onto it. */
export interface WordSpine {
  source: "measured" | "mixed" | "estimated";
  totalMs: number;
  words: SpineWord[];
  pauses: SpinePause[];
  medianWpm: number | null;
  /** The honest one-liner shown in the UI. */
  describes: string;
}

/* ── what crosses to the browser ───────────────────────────────────── */

export const BEHAVIORS = [
  "APPEAR",
  "DISAPPEAR",
  "SLAM",
  "DRIFT",
  "STRETCH",
  "COMPRESS",
  "COLLIDE",
  "SCATTER",
  "MULTIPLY",
  "ECHO",
  "OVERPRINT",
  "ERASE",
  "REVEAL",
  "CONCEAL",
  "FRAGMENT",
  "REASSEMBLE",
  "ACCUMULATE",
  "INTERRUPT",
  "REPEAT",
  "CROP",
  "INVERT",
  "TEAR",
  "SMEAR",
  "STUTTER",
  "FREEZE",
  "SURGE",
  "COLLAPSE",
] as const;
export type Behavior = (typeof BEHAVIORS)[number];

export interface VisualIntent {
  behavior: Behavior;
  /** At most one, and only when chaos or emphasis earns it. */
  secondary?: Behavior;
  intensity: number;
  /** TARGET ink coverage for this beat. The compositor closes the loop
   *  against what it measures, rather than trusting a multiplier. */
  density: number;
  /** The key unit's size as a fraction of frame height. */
  scale: number;
  rhythm: "hold" | "pulse" | "stutter" | "burst";
  continuity: (typeof CONTINUITIES)[number];
  /** 1 − certainty. Drives material degradation. */
  instability: number;
}

export interface TimedBeat {
  id: string;
  startMs: number;
  endMs: number;
  editorialRole: (typeof BEAT_ROLES)[number];
  emphasis: number;
  /** Null when the beat lives in a pause — the one moment where a change
   *  of picture competes with nothing. */
  narrationRange: { startMs: number; endMs: number } | null;
  sourceRange: Range;
  visualIntent: VisualIntent;
  text: {
    promotion: (typeof PROMOTIONS)[number];
    phrases: { text: string; role: "key" | "support" | "fragment" | "texture"; atMs: number }[];
    /** Parallel to `phrases`. 1.0 marks the one protected unit. */
    hierarchy: number[];
    /** THE BEAT'S OWN PROSE, in short fragments, for use as TEXTURE.
     *
     *  Without this the compositor's only raw material is the promoted
     *  phrases, so building a dense frame meant cloning the key phrase — and
     *  a frame covered in five copies of one line is exactly the "it does one
     *  thing over and over" failure. A page of small body text behind a
     *  headline is what editorial density actually looks like, and the essay
     *  is already sitting right there.
     *
     *  Verbatim, like everything else that reaches the screen. */
    body: string[];
    legibility: "protected" | "open" | "denied";
  };
  motif: { id: string; treatment: string; wearBefore: number; wearAfter: number } | null;
  /** Derived on the Worker. The browser is GIVEN this number and never
   *  re-derives one from a string — see `lib/rng.ts`. */
  seed: number;
}

export interface FilmCut {
  filmId: string;
  cutHash: string;
  seed: number;
  /** Bumped when the browser's meaning of a behaviour changes. */
  rendererContract: "1";
  durationMs: number;
  fps: 30;
  settings: Settings;
  spine: { source: WordSpine["source"]; wordTimedMs: number; totalMs: number };
  motifs: { id: string; phrase: string; arc: string; beatIds: string[] }[];
  beats: TimedBeat[];
  voice: {
    spans: { spanId: string; startMs: number; durationMs: number; url: string; sha256: string }[];
  } | null;
  /** Degrade-flag-continue, surfaced in the UI. If the legibility pass is
   *  firing constantly that is visible evidence the dials are set past what
   *  the composition can carry. */
  warnings: string[];
}

/* ── validation ────────────────────────────────────────────────────── */

export interface ParseOk {
  ok: true;
  film: Film;
}
export interface ParseFail {
  ok: false;
  errors: { path: string; message: string }[];
}

/** Parse and check referential integrity.
 *
 *  The shape check is zod's. The checks that matter are below it: a phrase
 *  whose offset does not land on its own text is the failure that puts a
 *  wrong word on screen, and it cannot be expressed as a type. */
export function parseFilm(value: unknown): ParseOk | ParseFail {
  const shape = FilmSchema.safeParse(value);
  if (!shape.success) {
    return {
      ok: false,
      errors: shape.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    };
  }
  const film = shape.data;
  const errors: { path: string; message: string }[] = [];

  const sectionIds = new Set(film.editorial.sections.map((s) => s.id));
  const beatIds = new Set(film.editorial.beats.map((b) => b.id));
  const motifIds = new Set(film.editorial.motifs.map((m) => m.id));
  const assetIds = new Set(film.assets.map((a) => a.assetId));

  const inEssay = (r: Range, path: string) => {
    if (r.endChar <= r.startChar) errors.push({ path, message: "range is empty or inverted" });
    if (r.endChar > film.essay.length) errors.push({ path, message: "range runs past the essay" });
  };

  for (const [i, s] of film.editorial.sections.entries()) {
    inEssay(s.range, `editorial.sections.${i}.range`);
  }

  for (const [i, b] of film.editorial.beats.entries()) {
    const at = `editorial.beats.${i}`;
    inEssay(b.range, `${at}.range`);
    if (!sectionIds.has(b.sectionId)) {
      errors.push({ path: `${at}.sectionId`, message: `unknown section "${b.sectionId}"` });
    }
    if (b.motifRef && !motifIds.has(b.motifRef.motifId)) {
      errors.push({ path: `${at}.motifRef`, message: `unknown motif "${b.motifRef.motifId}"` });
    }
    for (const [j, p] of b.phrases.entries()) {
      // THE CHECK THIS WHOLE FILE EXISTS FOR.
      if (film.essay.slice(p.offset, p.offset + p.text.length) !== p.text) {
        errors.push({
          path: `${at}.phrases.${j}`,
          message: `"${p.text.slice(0, 40)}" is not the essay's own text at ${p.offset}`,
        });
      }
      if (p.motifId && !motifIds.has(p.motifId)) {
        errors.push({
          path: `${at}.phrases.${j}.motifId`,
          message: `unknown motif "${p.motifId}"`,
        });
      }
    }
  }

  for (const [i, m] of film.editorial.motifs.entries()) {
    for (const [j, off] of m.occurrences.entries()) {
      // CASE-INSENSITIVE, deliberately, and only here. A motif is the essay
      // returning to its own phrase, and "Gimmick Economy" in a title is
      // the same motif as "the gimmick economy" in the body. What actually
      // goes ON SCREEN is a `Phrase`, checked strictly above — so this
      // looseness can never put a word the essay did not write into a frame.
      if (film.essay.slice(off, off + m.phrase.length).toLowerCase() !== m.phrase.toLowerCase()) {
        errors.push({
          path: `editorial.motifs.${i}.occurrences.${j}`,
          message: `motif "${m.phrase}" is not at ${off}`,
        });
      }
    }
  }

  for (const [i, c] of film.editorial.callbacks.entries()) {
    if (!beatIds.has(c.fromBeatId) || !beatIds.has(c.toBeatId)) {
      errors.push({ path: `editorial.callbacks.${i}`, message: "callback names an unknown beat" });
    }
  }

  for (const [i, s] of film.narration.spans.entries()) {
    inEssay(s.range, `narration.spans.${i}.range`);
    for (const key of ["voAssetId", "alignmentAssetId"] as const) {
      const id = s[key];
      if (id && !assetIds.has(id)) {
        errors.push({ path: `narration.spans.${i}.${key}`, message: `unknown asset "${id}"` });
      }
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, film };
}
