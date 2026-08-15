/* TYPOGRAPHY, MEASURED.
 *
 * This is why the compositor lives in the browser and not the Worker: every
 * decision below needs `ctx.measureText`, and there is no such thing on a
 * Worker. `fit` is extracted from the deleted prims-a.js, along with the two
 * lessons that made it correct.
 */

/** The film's faces. Self-hosted — see lab/fonts.css. A CDN dependency in
 *  the middle of the material the film is made of is not acceptable, and it
 *  is why every offline render before this one was in the wrong typeface. */
const FACES = {
  poster: '"Archivo Black", "Space Grotesk", sans-serif',
  grotesque: '"Space Grotesk", sans-serif',
  news: '"Newsreader", Georgia, serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
};

/** MEASURE, DO NOT GUESS.
 *
 * Estimating width from character count is what rendered "FRAMED AS
 * SUPPORTING" as "RAMED AS SUPPORTIN" — the type was drawn correctly and
 * then ran off both edges. This measures and shrinks until it actually
 * fits.
 *
 * TWO TRAPS, both paid for once already:
 *  1. `letterSpacing` must be set on the context BEFORE measuring. It
 *     changes the advance width and `measureText` accounts for it only if
 *     it is already applied.
 *  2. The cap is a FRACTION OF FRAME HEIGHT, never an absolute px. Every
 *     old caller passed a number like 44, so a film title rendered at the
 *     size of a caption — 6% of frame height — and it read as a bug, not a
 *     choice.
 */
export function fit(ctx, text, maxW, maxPx, weight, face) {
  const family = FACES[face] || FACES.grotesque;
  const style = (px) => `${weight || 700} ${px}px ${family}`;
  let size = Math.min(maxPx, maxW / Math.max(1, text.length * 0.55));
  ctx.font = style(size);
  let guard = 32;
  while (guard-- > 0 && ctx.measureText(text).width > maxW && size > 6) {
    size *= 0.93;
    ctx.font = style(size);
  }
  return size;
}

/** Set the context up for a unit and return its measured box. Centring is
 *  by measured advance rather than `textAlign`, because letter-spacing is
 *  applied after the last glyph too and `center` puts the trailing space
 *  inside the centred width. */
export function setType(ctx, unit, frameW, frameH) {
  const tracking = (unit.tracking || 0) * 0.06;
  ctx.letterSpacing = `${tracking.toFixed(3)}em`;
  const boxW = unit.box.w * frameW;
  const px = fit(ctx, unit.text, boxW, unit.size * frameH, unit.weight, unit.face);
  ctx.font = `${unit.weight || 700} ${px}px ${FACES[unit.face] || FACES.grotesque}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const m = ctx.measureText(unit.text);
  const w = m.width;
  const ascent = m.actualBoundingBoxAscent || px * 0.72;
  const descent = m.actualBoundingBoxDescent || px * 0.22;
  return { px, w, h: ascent + descent, ascent, descent };
}

export const CASES = {
  upper: (s) => s.toUpperCase(),
  lower: (s) => s.toLowerCase(),
  as: (s) => s,
};

export { FACES };
