/* THREEJS RENDERER — Layer 4 (COMPOSITION): the editorial type layer.
 *
 * Draws the SAME editorial content the Canvas 2D backend draws — same
 * stages, same units, same beats, same behaviors — on top of the
 * procedural WebGL ground. It reuses `resolveAt` from the compositor
 * directly rather than re-deriving anything: there is exactly one
 * editorial timeline, and both backends read it.
 *
 * Text is drawn with native Canvas 2D `fillText` — full browser font
 * rasterisation, not a WebGL glyph pass — because that is the highest
 * quality text rendering available and the ground layer has already been
 * flattened to pixels by the time this runs. There is nothing to gain and
 * legibility to lose by pushing type through WebGL.
 *
 * KNOCKOUT: the procedural ground is a noisy monochrome threshold field,
 * unlike Canvas 2D's authored plate. Standing rule 8 — "illegibility is
 * an explicit editorial decision, never an accident of a downstream
 * effect" — means type cannot be left to whatever value happens to sit
 * under it. Each unit gets a solid backing in the stage's own ground
 * colour before its ink is drawn. This is a scoped, honest stand-in for
 * the occlusion-budget legibility pass named as a known gap in
 * CANOPTICON_FILM_ENGINE.md — not that system, just its minimum
 * guarantee: real contrast, every frame, regardless of what renders
 * beneath it.
 */

import { resolveAt } from "../comp/compose.js";
import { CASES, setType } from "../core/type.js";
import { inkOf } from "../paint/frame.js";

const v = (n) => {
  const b = Math.max(0, Math.min(255, Math.round(n * 255)));
  return `rgb(${b},${b},${b})`;
};

/** Draw the editorial type for the given absolute film time onto `ctx`.
 *  `stages` is `buildStages(cut).stages` — the same value the Canvas 2D
 *  path passes to `prepareFilm`. Call this AFTER the ground layer has
 *  been composited into `ctx`, so the knockout paints over real pixels. */
export function renderTypeLayer(ctx, w, h, stages, tMs) {
  const res = resolveAt(stages, tMs);
  if (!res) return;
  const { units, stage } = res;
  const ink = inkOf(stage);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;

  for (const u of units) {
    const text = (CASES[u.case] || CASES.as)(u.text);
    const drawOne = (dx, dy, alpha) => {
      ctx.save();
      const m = setType(ctx, { ...u, text }, w, h);
      const x = u.box.x * w + dx;
      const y = u.box.y * h + m.ascent + dy;
      ctx.translate(x, y);
      if (u.rot) ctx.rotate((u.rot * Math.PI) / 180);
      ctx.scale(u.drawScale, u.drawScale);
      const a = Math.max(0, Math.min(1, alpha));
      if (a <= 0) {
        ctx.restore();
        return;
      }

      // Knockout backing, padded around the measured glyph box.
      const pad = m.px * 0.18;
      ctx.globalAlpha = a * 0.94;
      ctx.fillStyle = v(ink.ground);
      ctx.fillRect(-pad, -m.ascent - pad, m.w + pad * 2, m.h + pad * 2);

      ctx.globalAlpha = a;
      ctx.fillStyle = v(ink.ink);
      ctx.fillText(text, 0, 0);
      ctx.restore();
    };
    // ECHO/MULTIPLY: repeats of one unit, same discipline as drawFrame.
    if (u.repeat) {
      for (let i = u.repeat.n; i >= 1; i--) {
        drawOne(u.repeat.dx * w * i, u.repeat.dy * h * i, u.alpha * u.density * (1 - u.repeat.decay * i));
      }
    }
    drawOne(0, 0, u.alpha * u.density);
  }
  ctx.restore();
}
