/* SMOOTH, TILEABLE, SEEKABLE NOISE — the substrate everything organic in
 * this engine is made from.
 *
 * The previous engine's `noise2` was `sin(x*127.1 + y*311.7) * 43758.5453`
 * fract'd, which is WHITE NOISE, not a field: neighbouring pixels are
 * uncorrelated, so it can only ever look like television static. Nothing
 * built on it could read as paper, ink, tone or flow, and it had no time
 * term at all, so a "grain" computed from it was frozen — the same still
 * image on every frame of a six-second hold.
 *
 * This is value noise on a lattice with smoothstep interpolation, summed
 * over octaves, and TILEABLE so it can be sampled with a moving offset
 * without a seam. A moving offset over a tileable field is advection: it is
 * what makes the substrate flow rather than sit.
 *
 * Everything here is a pure function of (seed, x, y) — no per-frame state,
 * no accumulation. The exporter draws frame 900 directly as t=30s and the
 * stills script draws frames out of order; anything remembering the last
 * frame renders differently depending on which frames were asked for.
 */

import { mulberry32 } from "./rng.js";

const smooth = (t) => t * t * (3 - 2 * t);

/** One octave: a G×G lattice of random values, smooth-interpolated up to
 *  SIZE×SIZE. Lattice indices wrap, so the result tiles exactly. */
function octave(seed, g, size, out, amp) {
  const r = mulberry32(seed);
  const lat = new Float32Array(g * g);
  for (let i = 0; i < g * g; i++) lat[i] = r();
  const step = g / size;
  for (let y = 0; y < size; y++) {
    const fy = y * step;
    const y0 = Math.floor(fy);
    const ty = smooth(fy - y0);
    const r0 = (y0 % g) * g;
    const r1 = ((y0 + 1) % g) * g;
    for (let x = 0; x < size; x++) {
      const fx = x * step;
      const x0 = Math.floor(fx);
      const tx = smooth(fx - x0);
      const c0 = x0 % g;
      const c1 = (x0 + 1) % g;
      const a = lat[r0 + c0] + (lat[r0 + c1] - lat[r0 + c0]) * tx;
      const b = lat[r1 + c0] + (lat[r1 + c1] - lat[r1 + c0]) * tx;
      out[y * size + x] += (a + (b - a) * ty) * amp;
    }
  }
}

/** A tileable fBm tile, built once per film. SIZE is a power of two so the
 *  sampler can wrap with a mask instead of a modulo in the inner loop. */
export function makeTile(seed, size, octaves, lacunarity, gain) {
  const out = new Float32Array(size * size);
  let g = 4;
  let amp = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    octave(seed + o * 1013, Math.min(size, Math.round(g)), size, out, amp);
    norm += amp;
    g *= lacunarity;
    amp *= gain;
  }
  for (let i = 0; i < out.length; i++) out[i] /= norm;
  return out;
}

/** THE FILM'S TILES, built once and reused for every frame.
 *
 *  Three scales, because one is a texture and three is a material: `fibre`
 *  is the paper's own tooth, `tone` is the broad light-and-dark the ink
 *  sits in, and `turb` is the fast turbulence that makes an edge ragged.
 */
export function makeTiles(seed, size = 256) {
  return {
    size,
    mask: size - 1,
    fibre: makeTile(seed ^ 0x1f83d9ab, size, 4, 2.3, 0.55),
    tone: makeTile(seed ^ 0x5be0cd19, size, 3, 2.0, 0.62),
    turb: makeTile(seed ^ 0x9b05688c, size, 5, 2.1, 0.5),
  };
}

/** Bilinear wrap-sample. Kept out of the hot per-pixel loops — the renderer
 *  indexes the tiles directly — but used wherever a single value is wanted
 *  at an arbitrary point, such as a mark's edge or a unit's own drift. */
export function sample(tile, size, mask, x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const tx = x - xi;
  const ty = y - yi;
  const x0 = xi & mask;
  const x1 = (xi + 1) & mask;
  const r0 = (yi & mask) * size;
  const r1 = ((yi + 1) & mask) * size;
  const a = tile[r0 + x0] + (tile[r0 + x1] - tile[r0 + x0]) * tx;
  const b = tile[r1 + x0] + (tile[r1 + x1] - tile[r1 + x0]) * tx;
  return a + (b - a) * ty;
}

/* ── BOIL ────────────────────────────────────────────────────────────────
 *
 * A hand-drawn line wobbles because a human cannot draw the same line twice,
 * and the animation literature is explicit that REMOVING that wobble is what
 * makes a drawing read as frozen rather than still. Digitally the equivalent
 * is to advance the noise phase per frame.
 *
 * But not per frame at 30fps — that reads as video static. Real hand work is
 * shot on twos or threes, so the phase is QUANTISED to a lower rate and held.
 * That quantisation is the whole difference between "alive" and "noisy".
 */
export const BOIL_HZ = 12;

/** The boil step for a given time. Integer, so it is stable across a held
 *  pair of frames and identical however the frames are requested. */
export function boilStep(tMs) {
  return Math.floor((tMs / 1000) * BOIL_HZ);
}

/** A boil step's own offset into the tiles. Two large co-prime strides so
 *  successive steps land somewhere genuinely unrelated rather than crawling. */
export function boilOffset(step, seed) {
  const r = mulberry32((seed ^ 0x2545f491) + step * 2654435761);
  return { x: r() * 4096, y: r() * 4096 };
}
