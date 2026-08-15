/* THE FIELD — one continuous generative substrate, alive for the whole film.
 *
 * THIS IS THE THING FOUR REBUILDS DID NOT HAVE.
 *
 * Every previous engine asked "what picture represents this meaning?" and
 * then selected one — a primitive, a construction, a grammar, a medium, a
 * behaviour. Selection always produces a gallery, however large the menu,
 * and a gallery is what the operator kept seeing: the same centipede, the
 * same fixture, the same two objects, because a menu with two entries on it
 * can only ever serve two things.
 *
 * Nothing here is selected. There is ONE field. It exists before the first
 * word and after the last one, it is always moving, and the essay does not
 * choose from it — the essay MODULATES it. Two essays differ because their
 * modulation curves differ. Two seeds differ because the field itself is
 * built differently. There is no lexicon, no body plan, and no noun
 * anywhere in this file, because there is nothing here for a noun to pick.
 *
 * What it physically models is ink on paper: the paper's tooth, the broad
 * tone the ink sits in, the turbulence that makes an edge ragged, and the
 * wear that accumulates as a page is copied and re-copied. All of it moves,
 * because a still texture is a photograph and this is a film.
 */

import { boilOffset, boilStep, makeTiles } from "./noise.js";

/** The field's own parameters. Every one of these is a continuous dial the
 *  cut modulates over time — none of them names a thing that can be drawn. */
export const FIELD_REST = {
  /** Paper tooth. The fine, fixed-frequency bite of the stock. */
  tooth: 0.42,
  /** Broad light-and-dark. What makes one region of the page heavier. */
  tone: 0.5,
  /** Fast turbulence. Ragged edges, broken ink, disturbance. */
  turbulence: 0.22,
  /** How far into the noise we are zoomed. Low is coarse and blotchy, high
   *  is fine and dusty — a real difference in material, not a filter knob. */
  coarse: 0.5,
  /** Accumulated damage. A photocopy of a photocopy of a photocopy. */
  wear: 0.06,
  /** Advection speed. The substrate drifts; ink does not sit still on a
   *  moving press. */
  flowX: 0.012,
  flowY: -0.006,
  /** How hard the field bites into the ink. At 0 the type is clean; at 1
   *  the page is eating it. This is the dial that makes degradation an
   *  editorial decision rather than a post-process. */
  bite: 0.3,
};

export function makeField(seed) {
  return { tiles: makeTiles(seed, 256), seed };
}

/** Render the substrate into `dst` (Float32Array, w*h) at time `tMs`.
 *
 *  Flat loops with direct integer indexing, deliberately: this runs on
 *  ~480k pixels every frame and a per-pixel closure call is the difference
 *  between a preview that plays and one that stutters.
 *
 *  ANALYTIC IN t. Nothing accumulates between frames, so frame 900 drawn
 *  directly is identical to frame 900 reached by drawing 899 first.
 */
export function renderField(dst, w, h, tMs, p, field) {
  const { tiles, seed } = field;
  const { size, mask, fibre, tone, turb } = tiles;

  // The boil. Quantised to twos-and-threes, so the substrate is redrawn a
  // dozen times a second rather than thirty — the difference between the
  // handmade wobble and television static.
  const step = boilStep(tMs);
  const bo = boilOffset(step, seed);

  // Advection. A tileable field sampled at a moving offset IS a flowing
  // field, and it costs nothing beyond the offset.
  const t = tMs / 1000;
  const dx = p.flowX * t * size;
  const dy = p.flowY * t * size;

  // Frequency. `coarse` is a real zoom into the material, not an opacity.
  const fTone = (0.55 + p.coarse * 1.1) * (size / Math.max(w, h));
  const fTurb = fTone * 5.5;
  const fFibre = fTone * 17;

  // Wear does two things at once, which is why it reads as damage rather
  // than as a dark filter: it lifts the turbulence and drops the tone.
  const wTurb = p.turbulence + p.wear * 0.5;
  const wTone = p.tone * (1 - p.wear * 0.35);

  for (let y = 0; y < h; y++) {
    const yt = y * fTone + dy;
    const yb = y * fTurb + bo.y;
    const yf = y * fFibre;

    // Row bases, hoisted: the inner loop does index arithmetic and reads,
    // and nothing else.
    const ytI = ((yt | 0) & mask) * size;
    const ybI = ((yb | 0) & mask) * size;
    const yfI = ((yf | 0) & mask) * size;
    const ytF = yt - (yt | 0);
    const rowT0 = ytI;
    const rowT1 = (((yt | 0) + 1) & mask) * size;

    for (let x = 0; x < w; x++) {
      const xt = x * fTone + dx;
      const xtI = (xt | 0) & mask;
      const xtJ = ((xt | 0) + 1) & mask;
      const xtF = xt - (xt | 0);

      // Broad tone, bilinear — this one is smooth and must not band.
      const a = tone[rowT0 + xtI] + (tone[rowT0 + xtJ] - tone[rowT0 + xtI]) * xtF;
      const b = tone[rowT1 + xtI] + (tone[rowT1 + xtJ] - tone[rowT1 + xtI]) * xtF;
      const broad = a + (b - a) * ytF;

      // Turbulence and fibre, nearest — deliberately. Nearest-sampling a
      // high-frequency field gives a crisp bite; interpolating it gives mush
      // that reads as a blur rather than as tooth.
      const tb = turb[ybI + (((x * fTurb + bo.x) | 0) & mask)];
      const fb = fibre[yfI + (((x * fFibre) | 0) & mask)];

      let v = 0.5 + (broad - 0.5) * wTone * 1.6;
      v += (tb - 0.5) * wTurb;
      v += (fb - 0.5) * p.tooth * 0.42;
      dst[y * w + x] = v;
    }
  }
}

/** Where the ink plate sits relative to the paper this frame.
 *
 *  Registration error: on a real press the plates never land in exactly the
 *  same place twice, and the tiny per-impression slip is a large part of why
 *  print looks like print. Quantised to the boil so the whole material
 *  agrees about when a new impression happened.
 */
export function registration(tMs, seed, amount) {
  const step = boilStep(tMs);
  const o = boilOffset(step, seed ^ 0x7f4a7c15);
  return { x: (o.x % 1 - 0.5) * amount, y: (o.y % 1 - 0.5) * amount };
}
