// Per-shot variation — what makes a cut sequence an argument.
//
// The solver decides WHERE the cuts fall. This decides what changes across
// them, and without it a six-shot scene is one continuous image with a
// stutter in it: same word, same treatment, six times.
//
// Two rules, and they are what separate a sequence from noise:
//
//   DETERMINISTIC. Variation is a function of (scene, shot, state). Nothing
//   is random, so the same film always cuts the same way and a shot's hash
//   is stable — which is what lets a cut sequence participate in the cache
//   rather than defeating it.
//
//   IT ESCALATES. A sequence that varies arbitrarily reads as noise; one
//   that builds reads as an argument. Deformation rises across the shots so
//   the last cut lands hardest, which is how a run of spreads works: each
//   frame is one assertion, and the pressure accumulates.

/** The register a sequence is cut in. Mirrors Fiore's alternation of
 *  reversed and black spreads: not every other page, but in runs, so the
 *  flip itself is an event rather than a texture. */
export interface ShotVariation {
  /** The fragment of the line this shot carries. A sentence broken across
   *  cuts is read as a sequence of blows rather than a caption. */
  text: string;
  /** 0 shear · 1 scatter · 2 collapse. */
  mode: number;
  /** How far the deformation is pushed on this shot. */
  amount: number;
  /** Reversed plate — dark type on light. */
  invert: number;
  /** Quarter-turns. Used sparingly: constant rotation is a gimmick, one
   *  rotated shot in a run is an accent. */
  rotate: number;
}

export interface ShotPlanOptions {
  /** The line this scene is carrying. */
  line: string;
  shotCount: number;
  /** Stable per-scene offset so two scenes with the same line do not cut
   *  identically. */
  sceneIndex: number;
  /** 0..1. Higher pushes deformation harder and flips plates more often. */
  intensity: number;
  /** A contested line is held flatter — a claim should not be dramatised
   *  into looking like a finding. */
  contested: boolean;
}

/** Break a line into the fragments a cut sequence will carry.
 *
 *  Splits on words, then groups them so no fragment is a lone article or
 *  preposition — "THE" alone on a plate is a stutter, not an assertion.
 *  The shot count is deliberately NOT an input: fragmentation follows the
 *  sentence's own joints, and when there are more shots than fragments the
 *  fragments repeat (see `planShot`) — a phrase returning under a harder
 *  deformation is the shape of the argument tightening, not a shortfall to
 *  be padded out. */
export function fragmentLine(line: string): string[] {
  const WEAK = new Set([
    "a",
    "an",
    "the",
    "is",
    "was",
    "are",
    "were",
    "of",
    "to",
    "in",
    "on",
    "at",
    "it",
    "we",
    "you",
    "not",
    "and",
    "but",
    "as",
    "by",
    "for",
  ]);
  const words = line
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return [line.toUpperCase() || "—"];

  const frags: string[] = [];
  let current: string[] = [];
  for (const w of words) {
    current.push(w);
    // Close a fragment on a strong word, so each one ends on something
    // that can carry a frame by itself.
    if (!WEAK.has(w.toLowerCase()) && current.length >= 1) {
      frags.push(current.join(" ").toUpperCase());
      current = [];
    }
  }
  if (current.length > 0) {
    if (frags.length > 0) frags[frags.length - 1] += ` ${current.join(" ").toUpperCase()}`;
    else frags.push(current.join(" ").toUpperCase());
  }

  // Merge very short fragments forward — a two-letter plate reads as an
  // error rather than emphasis.
  const merged: string[] = [];
  for (const f of frags) {
    const prev = merged[merged.length - 1];
    if (prev !== undefined && (f.length <= 3 || prev.length <= 3)) {
      merged[merged.length - 1] = `${prev} ${f}`;
    } else {
      merged.push(f);
    }
  }
  return merged.length > 0 ? merged : [line.toUpperCase()];
}

/** Plan one shot. Pure: same inputs, same shot, always. */
export function planShot(opts: ShotPlanOptions, shotIndex: number): ShotVariation {
  const frags = fragmentLine(opts.line);
  const text = frags[shotIndex % frags.length] as string;

  // Position through the sequence, 0..1. Drives the escalation.
  const through = opts.shotCount <= 1 ? 0 : shotIndex / (opts.shotCount - 1);

  // Modes cycle rather than repeat, offset per scene so consecutive scenes
  // do not open on the same treatment.
  const mode = (shotIndex + opts.sceneIndex) % 3;

  // Deformation builds. A contested line is capped low: dramatising a claim
  // into looking like a finding is the one distortion that actually lies.
  const ceiling = opts.contested ? 0.34 : 0.4 + opts.intensity * 0.55;
  const amount = Math.min(ceiling, 0.12 + through * ceiling);

  // Plates flip in runs of two, not alternately — an every-other-frame flip
  // becomes a texture the eye stops reading as a change.
  const invert = Math.floor((shotIndex + opts.sceneIndex) / 2) % 2;

  // One accent turn per run at most, and only when the intensity asks for
  // it. Constant rotation is a gimmick.
  const rotate = opts.intensity > 0.6 && shotIndex > 0 && shotIndex % 5 === 3 ? 1 : 0;

  return { text, mode, amount: round3(amount), invert, rotate };
}

export function planShots(opts: ShotPlanOptions): ShotVariation[] {
  return Array.from({ length: Math.max(1, opts.shotCount) }, (_, i) => planShot(opts, i));
}

const round3 = (v: number): number => Math.round(v * 1000) / 1000;
