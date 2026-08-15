/* THE RENDERER. Dumb, reliable, and monochrome by construction.
 *
 * It knows nothing about meaning, nouns or metaphor. It is handed a
 * resolved stage and it draws it.
 *
 * THE KEY IDEA IS THAT DEGRADATION HAPPENS AT THRESHOLD TIME, NOT AS AN
 * OVERLAY. An overlay looks like a filter laid on a picture. A perturbed
 * threshold looks like a photocopy — because mechanically that is exactly
 * what a photocopier does.
 */

import { resolveAt } from "../comp/compose.js";
import { CASES, setType } from "../core/type.js";
import { noise2 } from "../core/rng.js";

/** The whole colour system. Four greys, a ground, an ink, and a polarity.
 *  There is no hue anywhere in this engine. When colour eventually arrives
 *  it arrives as one accent value in this object and nowhere else. */
export function inkOf(stage) {
  const flip = stage.ink.polarity === 1;
  const ground = flip ? stage.ink.ink : stage.ink.ground;
  const ink = flip ? stage.ink.ground : stage.ink.ink;
  return { ground, ink, flip };
}

const v = (n) => {
  const b = Math.max(0, Math.min(255, Math.round(n * 255)));
  return `rgb(${b},${b},${b})`;
};

/** Draw the composition as VALUES into a plate, then threshold the plate.
 *  Two passes, and the split is what makes the material read as printing
 *  rather than as post-processing. */
export function drawFrame(ctx, film, frameIndex) {
  const { stages, cut } = film;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const tMs = (frameIndex / cut.fps) * 1000;
  const res = resolveAt(stages, tMs);
  if (!res) return;
  const { units, stage } = res;
  const ink = inkOf(stage);

  // The plate runs coarser than the output. Aesthetically correct for a
  // photocopy, and it halves the per-pixel cost.
  const pw = Math.max(2, Math.round(w * 0.72));
  const ph = Math.max(2, Math.round(h * 0.72));
  const plate = film._plate || (film._plate = document.createElement("canvas"));
  if (plate.width !== pw) plate.width = pw;
  if (plate.height !== ph) plate.height = ph;
  const p = plate.getContext("2d", { willReadFrequently: true });

  p.setTransform(1, 0, 0, 1, 0, 0);
  p.fillStyle = v(ink.ground);
  p.fillRect(0, 0, pw, ph);

  p.save();
  p.translate(pw / 2 + stage.plate.x * pw, ph / 2 + stage.plate.y * ph);
  p.rotate((stage.plate.rot * Math.PI) / 180);
  p.scale(stage.plate.scale, stage.plate.scale);
  p.translate(-pw / 2, -ph / 2);

  for (const u of units) {
    const text = (CASES[u.case] || CASES.as)(u.text);
    const drawOne = (dx, dy, alpha) => {
      p.save();
      const m = setType(p, { ...u, text }, pw, ph);
      const x = u.box.x * pw + dx;
      const y = u.box.y * ph + m.ascent + dy;
      p.translate(x, y);
      if (u.rot) p.rotate((u.rot * Math.PI) / 180);
      p.scale(u.drawScale, u.drawScale);
      p.globalAlpha = Math.max(0, Math.min(1, alpha));
      p.fillStyle = v(ink.ink);
      p.fillText(text, 0, 0);
      p.restore();
    };
    // ECHO/MULTIPLY are repeats of ONE unit, not extra units — which is why
    // a field of a phrase costs one object and stays one object.
    if (u.repeat) {
      for (let i = u.repeat.n; i >= 1; i--) {
        drawOne(u.repeat.dx * pw * i, u.repeat.dy * ph * i, u.alpha * u.density * (1 - u.repeat.decay * i));
      }
    }
    drawOne(0, 0, u.alpha * u.density);
  }
  p.restore();

  // ── the material pass ───────────────────────────────────────────────
  const img = p.getImageData(0, 0, pw, ph);
  const d = img.data;
  const f = stage.field;
  const inkV = ink.ink;
  const groundV = ink.ground;
  const seed = cut.seed;
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      const i = (y * x === 0 ? y * pw + x : y * pw + x) * 4;
      // Luminance of what was drawn, 0..1.
      let value = d[i] / 255;
      // Paper grain perturbs the VALUE.
      if (f.grain > 0) value += (noise2(seed, x * 0.9, y * 0.9) - 0.5) * f.grain * 0.5;
      // The THRESHOLD wobbles — this is the photocopy.
      let t = 0.5;
      if (f.wear > 0) t += (noise2(seed + 7, x * 0.06, y * 0.06) - 0.5) * f.wear;
      const on = ink.flip ? value > t : value < t;
      const out = on ? inkV : groundV;
      const b = Math.round(out * 255);
      d[i] = b;
      d[i + 1] = b;
      d[i + 2] = b;
      d[i + 3] = 255;
    }
  }
  p.putImageData(img, 0, 0);

  // ── composite to the frame ──────────────────────────────────────────
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = v(ink.ground);
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(plate, 0, 0, w, h);
}

/** Everything the renderer needs, assembled once. */
export function prepareFilm(cut, stagesResult) {
  return { cut, stages: stagesResult.stages, grid: stagesResult.grid, _plate: null };
}
