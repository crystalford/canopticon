/* TREATMENTS — how a piece of text becomes marks on the plate.
 *
 * THE COMPLAINT THIS ANSWERS: "it's like you're presenting me with a template…
 * repetitive same text effects and same angles and positioning. A monotype
 * collage should be able to generate ten minutes of monotype collage things
 * happening."
 *
 * Exactly right, and the count is embarrassing. Before this file, a unit was
 * drawn ONE way: a single horizontal line, left-aligned, one face, one size,
 * one baseline — and for the protected headline the rotation resolved to about
 * ±1.3° even at maximum chaos. Every register, every transition, every arc and
 * every seed was a variation AROUND that one construction. Thousands of
 * parameter combinations, one look, because there was one way to set type.
 *
 * A treatment is a function from a string to GLYPH RUNS. It never draws —
 * it returns placements, so `frame.js` keeps a single draw path and knockout,
 * boil, migration, convergence and the press all keep working over whatever a
 * treatment invents. Standing rule 11: every system that operates on a visual
 * program treats the new structure, or none of them do.
 *
 * Measurement goes through `core/type.js`'s `fit`/`setType` and nowhere else.
 * A second measuring function is how two parts of the engine come to disagree
 * about how wide a word is.
 */

import { CASES, FACES, fit } from "../core/type.js";

/** One run: a string drawn at a place, at an angle, in a face. A `line` is one
 *  run; `perLetter` is one run per glyph. The renderer does not care which. */
function run(text, x, y, px, rot, u, extra) {
  return {
    text,
    x,
    y,
    px,
    rot: rot ?? 0,
    face: u.face,
    weight: u.weight,
    tracking: u.tracking,
    ...extra,
  };
}

/** Set the context to a face at a size, so a measurement is the truth. */
function useFont(ctx, u, px, tracking) {
  ctx.letterSpacing = `${((tracking ?? u.tracking ?? 0) * 0.06).toFixed(3)}em`;
  ctx.font = `${u.weight || 700} ${px}px ${FACES[u.face] || FACES.grotesque}`;
}

const W = (ctx, s) => ctx.measureText(s).width;

/* ── the treatments ───────────────────────────────────────────────────── */

export const TREATMENTS = {
  /** One horizontal line. The engine's only idea until now, kept because it
   *  is the right answer often — just not always. */
  line(ctx, u, fw, fh) {
    const px = fit(ctx, u.text, u.box.w * fw, u.size * fh, u.weight, u.face);
    useFont(ctx, u, px);
    return [run(u.text, 0, 0, px, 0, u)];
  },

  /** Squeezed. Negative tracking to the edge of collision — the newspaper
   *  headline that has to fit and will not be shrunk. */
  condensed(ctx, u, fw, fh) {
    const t = -0.45 - u.jitter * 0.35;
    const px = fit(ctx, u.text, u.box.w * fw, u.size * fh * 1.25, u.weight, u.face);
    useFont(ctx, u, px, t);
    return [run(u.text, 0, 0, px, 0, u, { tracking: t })];
  },

  /** Pulled apart. Wide tracking is a different reading speed, not a
   *  different decoration. */
  expanded(ctx, u, fw, fh) {
    const t = 1.2 + u.jitter * 2.2;
    const px = fit(ctx, u.text, u.box.w * fw, u.size * fh * 0.7, u.weight, u.face) * 0.8;
    useFont(ctx, u, px, t);
    return [run(u.text, 0, 0, px, 0, u, { tracking: t })];
  },

  /** LETTER-SPACED TO EXACTLY FILL ITS MEASURE. The oldest editorial move
   *  there is, and it needs real measurement — the tracking is solved for,
   *  not chosen. */
  justify(ctx, u, fw, fh) {
    const measure = u.box.w * fw;
    const px = u.size * fh * 0.8;
    useFont(ctx, u, px, 0);
    const natural = W(ctx, u.text);
    const gaps = Math.max(1, u.text.length - 1);
    // em of extra space per gap, converted back into the tracking unit
    // `setType` uses, so one convention governs spacing everywhere.
    const extraEm = (measure - natural) / gaps / px;
    const t = extraEm / 0.06;
    useFont(ctx, u, px, t);
    return [run(u.text, 0, 0, px, 0, u, { tracking: t })];
  },

  /** One word per line, stacked. A block of type rather than a line of it. */
  stack(ctx, u, fw, fh) {
    const words = u.text.split(/\s+/).filter(Boolean);
    const px = fit(ctx, longest(words), u.box.w * fw, u.size * fh, u.weight, u.face);
    useFont(ctx, u, px);
    const lead = px * (0.86 + u.jitter * 0.3);
    return words.map((wd, i) => run(wd, 0, i * lead, px, 0, u));
  },

  /** One LETTER per line, running down. Type as a vertical object. */
  column(ctx, u, fw, fh) {
    const chars = [...u.text.replace(/\s+/g, "")];
    const px = u.size * fh * 0.85;
    useFont(ctx, u, px);
    const lead = px * (0.78 + u.jitter * 0.25);
    return chars.map((c, i) => run(c, 0, i * lead, px, 0, u));
  },

  /** The line turned on its side. Reading up the left edge or down the right
   *  is a whole different composition from the same words. */
  rotate90(ctx, u, fw, fh) {
    const px = fit(ctx, u.text, u.box.h * fh * 3.2, u.size * fh, u.weight, u.face);
    useFont(ctx, u, px);
    return [run(u.text, 0, 0, px, u.jitter < 0.5 ? -90 : 90, u)];
  },

  /** Set along a curve, each glyph at its own angle. */
  arc(ctx, u, fw, fh) {
    const chars = [...u.text];
    const px = u.size * fh * 0.7;
    useFont(ctx, u, px);
    const radius = (u.box.w * fw) / (0.6 + u.jitter * 0.8);
    const total = chars.reduce((n, c) => n + W(ctx, c), 0);
    const sweep = total / radius;
    let a = -sweep / 2;
    const flip = u.jitter > 0.6 ? -1 : 1;
    return chars.map((c) => {
      const w = W(ctx, c);
      const step = w / radius;
      const mid = a + step / 2;
      const x = Math.sin(mid) * radius;
      const y = flip * (radius - Math.cos(mid) * radius);
      a += step;
      return run(c, x, y, px, (flip * mid * 180) / Math.PI, u);
    });
  },

  /** EVERY GLYPH PLACED ON ITS OWN — scaled, rotated, nudged. This is the one
   *  that most obviously breaks the template, and the one the old engine could
   *  not express at all. */
  perLetter(ctx, u, fw, fh) {
    const chars = [...u.text];
    const base = u.size * fh * 0.9;
    let x = 0;
    return chars.map((c, i) => {
      const n = frac(u.phase + i * 2654435761);
      const m = frac(u.phase * 3 + i * 40503);
      const px = base * (0.55 + n * 1.1);
      useFont(ctx, u, px);
      const w = W(ctx, c);
      const r = run(c, x, (m - 0.5) * base * 0.9, px, (n - 0.5) * 46 * (0.3 + u.chaos), u);
      x += w * (0.72 + m * 0.5);
      return r;
    });
  },

  /** Stroked, not filled. Same letterforms, opposite weight on the page. */
  outline(ctx, u, fw, fh) {
    const px = fit(ctx, u.text, u.box.w * fw, u.size * fh, u.weight, u.face);
    useFont(ctx, u, px);
    return [run(u.text, 0, 0, px, 0, u, { stroke: Math.max(1, px * 0.018) })];
  },

  /** Broken at a word boundary and separated. One phrase occupying two places
   *  on the frame is a composition; the same phrase in one place is a label. */
  split(ctx, u, fw, fh) {
    const words = u.text.split(/\s+/).filter(Boolean);
    if (words.length < 2) return TREATMENTS.line(ctx, u, fw, fh);
    const at = 1 + Math.floor(u.jitter * (words.length - 1));
    const a = words.slice(0, at).join(" ");
    const b = words.slice(at).join(" ");
    const px = fit(ctx, longest([a, b]), u.box.w * fw, u.size * fh, u.weight, u.face);
    useFont(ctx, u, px);
    const dx = (0.25 + u.jitter * 0.7) * u.box.w * fw;
    const dy = px * (1.1 + u.jitter * 1.6);
    return [run(a, 0, 0, px, 0, u), run(b, dx, dy, px, 0, u)];
  },

  /** Reflected. The second copy is the first one's shadow on the other side
   *  of an axis. */
  mirror(ctx, u, fw, fh) {
    const px = fit(ctx, u.text, u.box.w * fw, u.size * fh, u.weight, u.face);
    useFont(ctx, u, px);
    return [
      run(u.text, 0, 0, px, 0, u),
      run(u.text, 0, px * 1.15, px, 0, u, { flipY: true, alpha: 0.55 }),
    ];
  },

  /** One word tiled as pattern. Repetition used deliberately, which is a
   *  style — the operator said so — rather than an accident. */
  repeat(ctx, u, fw, fh) {
    const word = u.text.split(/\s+/)[0] ?? u.text;
    const px = u.size * fh * 0.5;
    useFont(ctx, u, px);
    const w = W(ctx, word);
    const cols = Math.max(2, Math.round((u.box.w * fw) / Math.max(1, w * 1.15)));
    const rows = 2 + Math.round(u.jitter * 4);
    const out = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        out.push(run(word, c * w * 1.15, r * px * 1.05, px, 0, u));
      }
    }
    return out;
  },
};

export const TREATMENT_NAMES = Object.keys(TREATMENTS);

/** Lay out a unit's text, whatever its treatment. Returns runs plus the box
 *  they actually occupy, because a treatment decides its own extent and the
 *  compositor must not assume a single line's worth. */
export function layoutText(ctx, unit, frameW, frameH) {
  const text = (CASES[unit.case] || CASES.as)(unit.text);
  const u = { ...unit, text };
  const fn = TREATMENTS[unit.treatment] || TREATMENTS.line;
  const runs = fn(ctx, u, frameW, frameH);

  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const r of runs) {
    useFont(ctx, u, r.px, r.tracking);
    const w = W(ctx, r.text);
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y - r.px * 0.78);
    x1 = Math.max(x1, r.x + w);
    y1 = Math.max(y1, r.y + r.px * 0.24);
  }
  if (!Number.isFinite(x0)) return { runs: [], w: 0, h: 0 };
  return { runs, w: x1 - x0, h: y1 - y0, ox: x0, oy: y0 };
}

const longest = (a) => a.reduce((b, s) => (s.length > b.length ? s : b), "");
const frac = (n) => {
  const x = Math.sin(n * 0.0001) * 43758.5453;
  return x - Math.floor(x);
};
