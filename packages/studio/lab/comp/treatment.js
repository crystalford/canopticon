/* SETTING TEXT — one continuous function, not thirteen named treatments.
 *
 * The previous version of this file had a table: `line`, `arc`, `column`,
 * `perLetter`, `stack`, `outline`, `mirror`, `justify`… thirteen rows, chosen
 * from. That is a preset system, and a preset system cannot produce a way of
 * setting type that its author did not type out. Once you have seen `arc`
 * twice you have seen `arc`.
 *
 * So there is one function, and it takes CONTINUOUS PARAMETERS. Those thirteen
 * are now regions of a space rather than entries in a list — and, far more
 * importantly, so is everything between and around them:
 *
 *   curvature 0   + verticality 0   + jitter 0    → a plain line
 *   curvature 0.8 + verticality 0                 → set along an arc
 *   curvature 0   + verticality 1                 → running down the frame
 *   curvature 0   + jitter 0.9                    → every glyph its own object
 *   curvature 0.3 + verticality 0.4 + jitter 0.5  → has no name, and exists
 *
 * The last line is the point. There are not thirteen ways to set a phrase;
 * there is a continuum, and a film that samples it does not repeat itself
 * because the samples are never the same.
 *
 * Runs go out, not pixels — the renderer keeps one draw path, so knockout,
 * boil, migration and the press operate over anything this invents.
 */

import { FACES, fit } from "../core/type.js";

const clamp01 = (n) => Math.max(0, Math.min(1, n));

function useFont(ctx, face, weight, px, tracking) {
  ctx.letterSpacing = `${(tracking * 0.06).toFixed(3)}em`;
  ctx.font = `${Math.round(weight)}px ${FACES[face] || FACES.grotesque}`;
  ctx.font = `${Math.round(weight)} ${px}px ${FACES[face] || FACES.grotesque}`;
}

const W = (ctx, s) => ctx.measureText(s).width;

/** Set a unit's text as glyph runs, from the style's continuous parameters.
 *
 *  Every decision below is a dial reading, not a branch on a name. The one
 *  place a discrete choice survives is whether a word breaks to a new line,
 *  because a line break genuinely is discrete.
 */
/** A style is required. The default exists so a unit built by a path that
 *  predates the style space still renders rather than taking the whole frame
 *  down — degrade, flag, continue. */
const FALLBACK = {
  caseMix: 0.7,
  weightAxis: 700,
  tracking: 0.2,
  stacking: 0,
  verticality: 0,
  curvature: 0,
  glyphJitter: 0,
  faceEntropy: 0,
  stroke: 0,
};

export function layoutText(ctx, u, fw, fh) {
  const s = u.style ?? FALLBACK;
  const text = s.caseMix > 0.62 ? u.text.toUpperCase() : u.text;
  const px0 = Math.max(6, u.size * fh);
  const face = u.face;
  const weight = s.weightAxis;
  const tracking = s.tracking + (u.trackingOffset ?? 0);

  // STACKING breaks the phrase into lines. At 0 it is one line; at 1 every
  // word is its own line. In between, lines of a few words — which is what a
  // measure is, arrived at continuously rather than chosen.
  const words = text.split(/\s+/).filter(Boolean);
  const perLine = Math.max(1, Math.round((1 - clamp01(s.stacking)) * (words.length - 1)) + 1);
  const lines = [];
  for (let i = 0; i < words.length; i += perLine) lines.push(words.slice(i, i + perLine).join(" "));

  // VERTICALITY turns a line into a column of single characters, continuously:
  // at 0.5 the line is set normally but rotated a quarter turn; at 1 it is one
  // glyph per row reading downward.
  const vertical = s.verticality;
  const runs = [];
  const lead = px0 * (0.82 + s.stacking * 0.5);

  for (const [li, line] of lines.entries()) {
    const chars = vertical > 0.5 ? [...line.replace(/\s+/g, "")] : null;
    const px = lines.length > 1 ? px0 * 0.9 : fitToBox(ctx, line, u, fw, px0, face, weight, tracking);
    useFont(ctx, face, weight, px, tracking);

    if (chars) {
      // A column. Its spacing follows the same leading as everything else, so
      // a vertical and a horizontal unit on one page still belong together.
      for (const [ci, c] of chars.entries()) {
        runs.push(mk(c, 0, li * lead * 6 + ci * px * 0.8, px, 0, face, weight, tracking, s, ci, u));
      }
      continue;
    }

    // CURVATURE bends the baseline. At 0 the maths degenerates to a straight
    // line, so there is no branch — a flat arc IS a line.
    if (s.curvature > 0.02 || s.glyphJitter > 0.02) {
      const cs = [...line];
      const total = cs.reduce((n, c) => n + W(ctx, c), 0);
      const radius = total / Math.max(0.001, s.curvature * 1.9);
      let a = -(total / radius) / 2;
      let x = 0;
      for (const [ci, c] of cs.entries()) {
        const w = W(ctx, c);
        const step = w / radius;
        const midA = a + step / 2;
        const onArc = s.curvature > 0.02;
        const jx = jitter(u.phase, ci, 1) * s.glyphJitter;
        const jy = jitter(u.phase, ci, 2) * s.glyphJitter;
        const jr = jitter(u.phase, ci, 3) * s.glyphJitter;
        const jp = 1 + jitter(u.phase, ci, 4) * s.glyphJitter * 1.1;
        runs.push(
          mk(
            c,
            (onArc ? Math.sin(midA) * radius : x) + jx * px * 0.5,
            li * lead + (onArc ? radius - Math.cos(midA) * radius : 0) + jy * px * 0.6,
            px * Math.max(0.35, jp),
            (onArc ? (midA * 180) / Math.PI : 0) + jr * 40,
            face,
            weight,
            tracking,
            s,
            ci,
            u,
          ),
        );
        a += step;
        x += w * (1 + jitter(u.phase, ci, 5) * s.glyphJitter * 0.5);
      }
      continue;
    }

    runs.push(mk(line, 0, li * lead, px, 0, face, weight, tracking, s, 0, u));
  }

  // VERTICALITY between 0 and 0.5 rotates the whole unit rather than
  // rebuilding it as a column — the same dial, continuous across its range.
  if (vertical > 0 && vertical <= 0.5) {
    const deg = vertical * 180;
    for (const r of runs) r.rot += deg;
  }

  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const r of runs) {
    useFont(ctx, r.face, r.weight, r.px, r.tracking);
    const w = W(ctx, r.text);
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y - r.px * 0.78);
    x1 = Math.max(x1, r.x + w);
    y1 = Math.max(y1, r.y + r.px * 0.24);
  }
  if (!Number.isFinite(x0)) return { runs: [], w: 0, h: 0 };
  return { runs, w: x1 - x0, h: y1 - y0 };
}

function mk(text, x, y, px, rot, face, weight, tracking, s, ci, u) {
  // FACE ENTROPY. At 0 one face throughout; at 1 the glyphs disagree. This is
  // the ransom note and the Swiss page as two readings of one dial.
  const mixed =
    s.faceEntropy > 0.15 && Math.abs(jitter(u.phase, ci, 6)) < s.faceEntropy
      ? u.altFace
      : face;
  return {
    text,
    x,
    y,
    px,
    rot,
    face: mixed,
    weight,
    tracking,
    stroke: s.stroke > 0 ? px * s.stroke : 0,
  };
}

function fitToBox(ctx, text, u, fw, px0, face, weight, tracking) {
  useFont(ctx, face, weight, px0, tracking);
  return fit(ctx, text, u.box.w * fw, px0, weight, face);
}

/** Deterministic per-glyph noise in −1..1. Seeded from the unit's own phase so
 *  a glyph's jitter is stable across every frame it lives for. */
function jitter(phase, i, salt) {
  const x = Math.sin((phase + i * 374761393 + salt * 668265263) * 0.0001) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}
