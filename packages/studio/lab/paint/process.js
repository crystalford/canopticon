/* PROCESSES — how ink and paper become an image.
 *
 * THE INVARIANT, MEASURED. Across fourteen frames spanning seven different
 * worlds, ten layouts and twelve treatments, the proportion of MIDTONE pixels
 * ranged from 0.1% to 3.9%. Every frame was between 96% and 99.9% pure black
 * or pure white. There was no grey anywhere in any film this engine has ever
 * made.
 *
 * That is what "it still looks the same" means, as a number. One press —
 * threshold the ink against a noise field — ran on every frame ever rendered.
 * Worlds, treatments, layouts and passage readings all funnel into it, so
 * however much they vary, the IMAGE is manufactured by identical machinery
 * every time. The press is the look.
 *
 * And this is the third time I have made the same mistake at a different
 * level: add variety upstream of an unchanged bottleneck. Registers funnelled
 * into one composition; treatments and worlds funnelled into one press;
 * passage readings funnelled into the same press again. Each round the inputs
 * got richer and the output stayed identical.
 *
 * So the process itself is now plural. Each one is a different way of turning
 * coverage plus paper into pixels, and they do not agree about the most basic
 * question a printed image answers: how many values are there between black
 * and white.
 */

const smoothstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / Math.max(1e-6, b - a)));
  return t * t * (3 - 2 * t);
};

/** A 4×4 ordered dither matrix, normalised. Real halftoning at small scale,
 *  and the cheapest way to get apparent tone out of two values. */
const BAYER = [
  0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5,
].map((v) => (v + 0.5) / 16);

export const PROCESSES = {
  /** THE PHOTOCOPY. Threshold against the field: ink either takes or it does
   *  not. Two values, hard edges, generation loss. The engine's only process
   *  until now, kept because it is genuinely strong — and demoted. */
  photocopy(cov, fv, p) {
    const thr = 0.5 - (fv - 0.5) * p.bite * 2.0;
    let v = smoothstep(thr - p.soft, thr + p.soft, cov);
    if (v < 0.5 && fv > p.speckle) v = Math.min(1, v + (fv - p.speckle) * 3.2);
    else if (v > 0.5 && fv < p.dropout) v = Math.max(0, v - (p.dropout - fv) * 2.6);
    return v;
  },

  /** CLEAN. No threshold at all — the coverage IS the image, antialiasing
   *  intact, the paper showing as real tone underneath. Crisp type on a
   *  toned ground, which is a fundamentally different picture from a
   *  photocopy of the same composition and was previously unreachable. */
  clean(cov, fv, p) {
    const paper = 0.06 + (fv - 0.5) * 0.18 * p.bite;
    return Math.max(0, Math.min(1, cov * (1 - paper) + paper * 0.35));
  },

  /** LITHO. Posterised to a handful of levels. Between the photocopy's two
   *  and clean's continuum: flat plates of tone with visible steps. */
  litho(cov, fv, p) {
    const steps = 4;
    const t = Math.max(0, Math.min(1, cov + (fv - 0.5) * p.bite * 0.7));
    return Math.round(t * steps) / steps;
  },

  /** SCREEN. A real halftone: ordered dither at the pixel level, so apparent
   *  tone is made of dots rather than of grey. Two values on the page, many
   *  in the eye — which is what a printed photograph actually is. */
  screen(cov, fv, p, x, y) {
    const t = Math.max(0, Math.min(1, cov + (fv - 0.5) * p.bite * 0.5));
    const d = BAYER[((y & 3) << 2) | (x & 3)];
    return t > d ? 1 : 0;
  },

  /** DISSOLVE. Thresholded against the field with no softening, so the edge
   *  between ink and paper is eaten entirely and the type appears to be
   *  granulating into the stock. */
  dissolve(cov, fv, p) {
    // THE THRESHOLD SWING HAS TO BE BOUNDED. At (0.6 + bite * 1.6) the field
    // could push the threshold past 1, which erases a word entirely rather
    // than granulating its edge — measured on a real frame, this process ate
    // everything but four characters and left a page of noise. Dissolve is an
    // edge effect; ink at full coverage always takes.
    const swing = Math.min(0.34, 0.12 + p.bite * 0.3);
    const thr = 0.5 - (fv - 0.5) * swing;
    return cov > thr ? 1 : 0;
  },

  /** SCAN. Horizontal banding, as a display rather than a page. Tone
   *  survives; the raster is what you see. */
  scan(cov, fv, p, x, y) {
    const line = y % 3 === 0 ? 0.55 : 1;
    const t = cov * (1 - (0.5 - fv) * p.bite * 0.8);
    return Math.max(0, Math.min(1, t * line));
  },
};

export const PROCESS_NAMES = Object.keys(PROCESSES);
